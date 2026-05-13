import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_MODELLI = [
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
]

// Origini autorizzate a chiamare la function (no wildcard).
// Sostituisci il dominio di produzione con quello reale al deploy.
const ALLOWED_ORIGINS = [
  'http://localhost:4200',
  'https://attesazero.example.it',
]

// Costruisce gli header CORS riflettendo solo origini in allowlist
function corsHeaders(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// Scarica il PDF dallo Storage e lo converte in base64
async function scaricaPdfBase64(supabase: any, storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('referti').download(storagePath)
  if (error) throw new Error('download_failed')

  const buffer = await data.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

// Invia il PDF a Gemini e restituisce la spiegazione in italiano.
// Prova i modelli in sequenza se uno è sovraccarico (503) o ha quota esaurita (429).
async function analizzaConGemini(pdfBase64: string, geminiKey: string): Promise<string> {
  const corpo = JSON.stringify({
    contents: [{
      parts: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          text: `Sei un assistente medico. Analizza questo referto medico in italiano semplice per un paziente non specializzato.
Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo il JSON.
Usa questa struttura esatta:
{
  "sommario": "Una frase riassuntiva chiara e rassicurante per il paziente.",
  "valori": [
    { "nome": "Nome del parametro", "nota": "Breve nota descrittiva", "valore": "145 mg/dL", "riferimento": "< 130 mg/dL", "stato": "attenzione" }
  ],
  "domande": ["Domanda 1 da fare al medico", "Domanda 2", "Domanda 3"]
}
Per il campo "stato" usa solo uno di questi tre valori: "normale", "attenzione", "critico".
Includi solo i valori numerici presenti nel referto. Non inventare valori.
Se il documento non è un referto medico (ad esempio è un CV, una fattura, un contratto), restituisci esattamente: { "sommario": "Il documento caricato non sembra un referto medico. Carica un documento medico valido.", "valori": [], "domande": [] }`,
        },
      ],
    }],
  })

  for (const url of GEMINI_MODELLI) {
    const risposta = await fetch(`${url}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo,
    })

    // 503 = sovraccarico, 429 = quota esaurita: prova il modello successivo
    if (risposta.status === 503 || risposta.status === 429) {
      continue
    }

    if (!risposta.ok) {
      throw new Error('gemini_error')
    }

    const json = await risposta.json()
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Nessuna risposta ricevuta.'
  }

  throw new Error('gemini_unavailable')
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers })
  }

  try {
    // 1. Verifica JWT utente — l'Authorization header deve esistere
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Non autorizzato', { status: 401, headers })
    }

    // 2. Client "user-scoped": eredita il JWT, RLS attiva
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: erroreUser } = await userClient.auth.getUser()
    if (erroreUser || !userData?.user) {
      return new Response('Sessione non valida', { status: 401, headers })
    }
    const userId = userData.user.id

    // 3. Valida input
    const body = await req.json().catch(() => null)
    const refertoId = body?.referto_id
    if (!Number.isInteger(refertoId) || refertoId <= 0) {
      return new Response('referto_id non valido', { status: 400, headers })
    }

    // 4. Ownership check: il referto deve appartenere all'utente autenticato.
    // La query usa il client user-scoped → RLS impedisce di leggere referti altrui.
    const { data: referto, error: erroreReferto } = await userClient
      .from('referti')
      .select('storage_path')
      .eq('id', refertoId)
      .eq('user_id', userId)
      .single()

    if (erroreReferto || !referto) {
      return new Response('Referto non trovato', { status: 404, headers })
    }

    // 5. Service role SOLO per Storage download e insert in cache (operazioni privilegiate).
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) {
      return new Response('Servizio AI non disponibile', { status: 503, headers })
    }

    const pdfBase64 = await scaricaPdfBase64(adminClient, referto.storage_path)
    const testo = await analizzaConGemini(pdfBase64, geminiKey)

    // Salva in cache (insert idempotente: il frontend controlla prima se esiste)
    await adminClient.from('referti_spiegazioni').insert({ referto_id: refertoId, testo })

    return new Response(JSON.stringify({ testo }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch {
    // Nessun dettaglio interno verso il client. Log lato Supabase senza PII.
    console.error('spiega-referto: errore interno')
    return new Response('Errore durante l\'analisi.', { status: 500, headers })
  }
})
