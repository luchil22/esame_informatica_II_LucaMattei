import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';

// Riga della tabella referti (metadati del file PDF).
// Il PDF vero sta nel bucket Storage "referti", non nel database.
interface Referto {
  id: number;
  nome_file: string;
  storage_path: string; // percorso nel bucket Storage: "{userId}/{timestamp}-{uuid}-{nome}.pdf"
  created_at: string;
}

// Valore numerico estratto dal referto dall'analisi AI Gemini.
interface ValoreReferto {
  nome: string;
  nota: string;
  valore: string;
  riferimento: string;
  stato: 'normale' | 'attenzione' | 'critico';
}

// Struttura JSON restituita dalla Edge Function spiega-referto.
// Se Gemini non risponde in formato JSON, si usa il fallback testo libero (campo `spiegazione`).
interface SpiegazioneStrutturata {
  sommario: string;
  valori: ValoreReferto[];
  domande: string[];
}

// Schermata S4 — Caricamento, lista e verifica AI dei referti PDF (privata, richiede login).
// Interazione con DB:
//   - LETTURA:   tabella referti + bucket Storage "referti" + tabella referti_spiegazioni
//   - SCRITTURA: bucket Storage "referti" (upload PDF) + tabella referti (INSERT metadati)
//   ← INTERAZIONE DB RICHIESTA D'ESAME: upload referto PDF (clic file + bottone Carica).
@Component({
  selector: 'app-referti',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './referti.component.html',
})
export class RefertiComponent implements OnInit {
  // Limite dimensione PDF: 10 MB (10 * 1024 * 1024 bytes).
  private readonly MAX_BYTES = 10 * 1024 * 1024;
  // Magic bytes PDF: ogni PDF valido inizia con i byte %PDF (0x25, 0x50, 0x44, 0x46).
  private readonly MAGIC_PDF = [0x25, 0x50, 0x44, 0x46];

  referti     = signal<Referto[]>([]);
  caricamento = signal(false);
  errore      = signal('');
  successo    = signal('');
  uploading   = signal(false); // true durante l'upload a Supabase Storage

  // File selezionato tramite file input o drag-and-drop, in attesa del clic "Carica".
  fileScelto = signal<File | null>(null);
  dragSopra  = signal(false); // true quando un file è trascinato sopra la drop zone

  // Stato pannello verifica AI (si apre cliccando "Verifica con AI" su un referto).
  refertoDaVerificare    = signal<Referto | null>(null);
  spiegazioneStrutturata = signal<SpiegazioneStrutturata | null>(null);
  spiegazione            = signal(''); // fallback per cache in testo libero (pre-strutturazione)
  urlPdfSicuro           = signal<SafeResourceUrl | null>(null); // URL firmato per l'iframe
  consensoDato           = signal(false);  // l'utente deve spuntare la checkbox prima dell'analisi AI
  elaborazione           = signal(false);  // true mentre la Edge Function elabora
  spiegazioneErrore      = signal('');

  // Stato eliminazione — mostra bottoni Annulla/Conferma solo per il referto selezionato.
  refertoInEliminazione = signal<number | null>(null);
  eliminando            = signal(false);

  constructor(
    private supabase: SupabaseService,
    private auth: AuthService,
    private sanitizer: DomSanitizer,
  ) {}

  // Carica la lista dei referti dell'utente al primo accesso alla pagina.
  async ngOnInit(): Promise<void> {
    await this.caricaReferti();
  }

  // Legge i metadati dei referti dalla tabella referti.
  // LETTURA → tabella: referti (SELECT con RLS: solo righe con user_id = utente corrente).
  async caricaReferti(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set('');

    const { data, error } = await this.supabase.client
      .from('referti')
      .select('id, nome_file, storage_path, created_at')
      .eq('user_id', this.auth.getUserId())
      .order('created_at', { ascending: false });

    if (error) {
      this.errore.set('Errore nel caricamento dei referti.');
      this.caricamento.set(false);
      return;
    }

    this.referti.set(data as Referto[]);
    this.caricamento.set(false);
  }

  // Riceve l'evento change del file input e passa il file ad accettaFile().
  async selezioneFile(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    await this.accettaFile(file);
  }

  // Valida il file e, se valido, lo imposta come fileScelto in attesa del caricamento.
  // Gestisce sia la selezione da file input che il drag-and-drop.
  private async accettaFile(file: File): Promise<void> {
    const erroreValid = await this.validaPdf(file);
    if (erroreValid) {
      this.errore.set(erroreValid);
      this.fileScelto.set(null);
      return;
    }
    this.fileScelto.set(file);
    this.errore.set('');
    this.successo.set('');
  }

  // Verifica il file prima dell'upload: dimensione, MIME type e magic bytes.
  // I magic bytes controllano il contenuto reale del file, non solo l'estensione.
  // Un file rinominato "documento.pdf" ma con contenuto diverso non passa il controllo.
  private async validaPdf(file: File): Promise<string> {
    if (file.size === 0) return 'Il file è vuoto.';
    if (file.size > this.MAX_BYTES) return 'File troppo grande: massimo 10 MB.';
    if (file.type !== 'application/pdf') return 'Tipo di file non valido: serve un PDF.';

    // Legge solo i primi 4 byte del file (slice) per confrontarli con i magic bytes PDF.
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const okMagic = this.MAGIC_PDF.every((b, i) => head[i] === b);
    if (!okMagic) return 'Il file non sembra un PDF valido.';

    return '';
  }

  // Rimuove caratteri speciali dal nome file per evitare path traversal e XSS.
  // Tieni solo lettere, numeri, punto, underscore, trattino. Tronca a 100 caratteri.
  private sanitizzaNomeFile(nome: string): string {
    const pulito = nome.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.');
    return pulito.slice(0, 100) || 'referto.pdf';
  }

  // Evidenzia la drop zone visivamente quando l'utente trascina un file sopra.
  onDragOver(evento: DragEvent): void {
    evento.preventDefault(); // necessario per consentire il drop
    this.dragSopra.set(true);
  }

  // Rimuove l'evidenziazione quando il cursore lascia la drop zone.
  onDragLeave(): void {
    this.dragSopra.set(false);
  }

  // Gestisce il rilascio del file nella drop zone.
  async onDrop(evento: DragEvent): Promise<void> {
    evento.preventDefault();
    this.dragSopra.set(false);
    const file = evento.dataTransfer?.files?.[0];
    if (!file) {
      this.errore.set('Nessun file rilevato.');
      return;
    }
    await this.accettaFile(file);
  }

  // Annulla la selezione del file corrente.
  annullaScelta(): void {
    this.fileScelto.set(null);
    this.errore.set('');
    this.successo.set('');
  }

  // Formatta la dimensione del file in KB (se < 1 MB) o MB (se >= 1 MB).
  formattaDimensione(bytes: number): string {
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Carica il PDF scelto su Supabase Storage e salva i metadati nella tabella referti.
  // ← INTERAZIONE DB RICHIESTA D'ESAME: scrittura con clic + input file.
  // Step 1 → Storage bucket "referti": upload del file PDF
  //           Path: "{userId}/{timestamp}-{uuid}-{nomeSanitizzato}.pdf"
  //           L'UUID evita collisioni; il prefisso userId è richiesto dalla RLS del bucket.
  // Step 2 → tabella referti: INSERT del record con nome_file e storage_path.
  async caricaReferto(): Promise<void> {
    const file = this.fileScelto();
    if (!file) return;

    // Rivalida lato client prima di inviare (difesa in profondità oltre alle policy del bucket).
    const erroreValid = await this.validaPdf(file);
    if (erroreValid) {
      this.errore.set(erroreValid);
      return;
    }

    const userId = this.auth.getUserId();
    if (!userId) {
      this.errore.set('Sessione non valida. Effettua di nuovo il login.');
      return;
    }

    this.uploading.set(true);
    this.errore.set('');
    this.successo.set('');

    // Costruisce il percorso del file nel bucket: prefisso userId + UUID + nome sicuro.
    const nomeSafe  = this.sanitizzaNomeFile(file.name);
    const nomeUnico = `${Date.now()}-${crypto.randomUUID()}-${nomeSafe}`;
    const percorso  = `${userId}/${nomeUnico}`;

    // upsert:false impedisce di sovrascrivere file esistenti con lo stesso path.
    const { error: erroreStorage } = await this.supabase.client
      .storage.from('referti')
      .upload(percorso, file, {
        upsert: false,
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (erroreStorage) {
      this.errore.set('Errore nel caricamento del file.');
      this.uploading.set(false);
      return;
    }

    // Salva i metadati nel database (nome sanitizzato, non il nome grezzo dell'utente).
    const { error: erroreDb } = await this.supabase.client
      .from('referti')
      .insert({
        user_id:      userId,
        nome_file:    nomeSafe,
        storage_path: percorso,
      });

    if (erroreDb) {
      this.errore.set('File caricato ma errore nel salvataggio dei metadati.');
      this.uploading.set(false);
      return;
    }

    this.successo.set('Referto caricato con successo!');
    this.fileScelto.set(null);
    this.uploading.set(false);
    await this.caricaReferti(); // aggiorna la lista
  }

  // Apre il pannello di verifica AI per il referto selezionato e genera l'URL firmato.
  apriVerifica(referto: Referto): void {
    this.refertoDaVerificare.set(referto);
    this.spiegazione.set('');
    this.spiegazioneStrutturata.set(null);
    this.urlPdfSicuro.set(null);
    this.consensoDato.set(false);
    this.elaborazione.set(false);
    this.spiegazioneErrore.set('');
    this.generaUrlPdf(referto.storage_path);
  }

  // Chiude il pannello di verifica AI e resetta tutto lo stato correlato.
  chiudiVerifica(): void {
    this.refertoDaVerificare.set(null);
    this.spiegazione.set('');
    this.spiegazioneStrutturata.set(null);
    this.urlPdfSicuro.set(null);
    this.consensoDato.set(false);
    this.elaborazione.set(false);
    this.spiegazioneErrore.set('');
  }

  // Genera un URL firmato (valido 1 ora) per visualizzare il PDF nell'iframe.
  // LETTURA → Storage bucket "referti": createSignedUrl non legge il file, crea solo un URL temporaneo.
  // bypassSecurityTrustResourceUrl serve per usare un URL esterno nel [src] di <iframe>
  // senza che Angular lo blocchi come potenziale XSS.
  async generaUrlPdf(storagePath: string): Promise<void> {
    const { data, error } = await this.supabase.client
      .storage.from('referti')
      .createSignedUrl(storagePath, 3600); // URL valido 3600 secondi = 1 ora

    if (!error && data) {
      this.urlPdfSicuro.set(this.sanitizer.bypassSecurityTrustResourceUrl(data.signedUrl));
    }
  }

  // Attiva lo stato di conferma eliminazione (mostra i bottoni Annulla/Conferma).
  richiestaEliminazione(id: number): void {
    this.refertoInEliminazione.set(id);
  }

  // Annulla la richiesta di eliminazione senza fare nulla.
  annullaEliminazione(): void {
    this.refertoInEliminazione.set(null);
  }

  // Elimina il referto in tre step nell'ordine corretto per evitare dati orfani.
  // Step 1 → tabella referti_spiegazioni: DELETE della cache AI (se esiste)
  // Step 2 → Storage bucket "referti": DELETE del file PDF
  // Step 3 → tabella referti: DELETE del record metadati
  // L'ordine è importante: prima la cache, poi il file, poi il record.
  async eliminaReferto(referto: Referto): Promise<void> {
    this.eliminando.set(true);
    this.errore.set('');

    // Elimina la spiegazione AI in cache (errore ignorato: potrebbe non esistere).
    await this.supabase.client
      .from('referti_spiegazioni')
      .delete()
      .eq('referto_id', referto.id);

    // Elimina il file dal bucket Storage.
    const { error: erroreStorage } = await this.supabase.client
      .storage.from('referti').remove([referto.storage_path]);

    if (erroreStorage) {
      this.errore.set('Errore nell\'eliminazione del file.');
      this.eliminando.set(false);
      this.refertoInEliminazione.set(null);
      return;
    }

    // Elimina il record dalla tabella referti.
    const { error: erroreDb } = await this.supabase.client
      .from('referti')
      .delete()
      .eq('id', referto.id);

    if (erroreDb) {
      this.errore.set('Errore nell\'eliminazione del referto.');
      this.eliminando.set(false);
      this.refertoInEliminazione.set(null);
      return;
    }

    // Se il pannello AI era aperto su questo referto, lo chiude.
    if (this.refertoDaVerificare()?.id === referto.id) {
      this.chiudiVerifica();
    }

    this.refertoInEliminazione.set(null);
    this.eliminando.set(false);
    await this.caricaReferti();
  }

  // Aggiorna il signal consensoDato al cambio della checkbox nel template.
  aggiornaConsenso(evento: Event): void {
    const checkbox = evento.target as HTMLInputElement;
    this.consensoDato.set(checkbox.checked);
  }

  // Prova a interpretare la risposta dell'AI come JSON strutturato.
  // Se il JSON non è valido, usa il testo come fallback nel template.
  private parsaRisposta(testo: string): void {
    try {
      const inizio = testo.indexOf('{');
      const fine   = testo.lastIndexOf('}');
      if (inizio !== -1 && fine !== -1) {
        const json = JSON.parse(testo.substring(inizio, fine + 1)) as SpiegazioneStrutturata;
        this.spiegazioneStrutturata.set(json);
        return;
      }
    } catch {
      // JSON non valido — mostra il testo grezzo nel fallback
    }
    this.spiegazione.set(testo);
  }

  // Analizza il referto con AI: prima controlla la cache, poi chiama la Edge Function.
  // Step 1 → LETTURA tabella referti_spiegazioni: cerca la spiegazione in cache
  // Step 2 → (solo se cache assente) chiama la Edge Function "spiega-referto"
  //           che legge il PDF da Storage, lo invia a Gemini e salva il risultato in cache
  // Step 3 → LETTURA tabella referti_spiegazioni: rilegge il risultato salvato dall'Edge Function
  // L'utente deve dare il consenso esplicito (checkbox) prima che questa funzione venga chiamata.
  async analizzaReferto(): Promise<void> {
    if (!this.consensoDato()) return;

    const referto = this.refertoDaVerificare();
    if (!referto) return;

    this.elaborazione.set(true);
    this.spiegazioneErrore.set('');
    this.spiegazione.set('');
    this.spiegazioneStrutturata.set(null);

    // 1. Controlla se la spiegazione esiste già in cache (evita chiamate inutili a Gemini).
    const { data: cache } = await this.supabase.client
      .from('referti_spiegazioni')
      .select('testo')
      .eq('referto_id', referto.id)
      .maybeSingle(); // maybeSingle restituisce null se non trovato, senza errore

    if (cache) {
      this.parsaRisposta((cache as any).testo);
      this.elaborazione.set(false);
      return;
    }

    // 2. Nessuna cache → chiama la Edge Function Deno che usa la Service Role Key.
    const { error } = await this.supabase.client.functions.invoke('spiega-referto', {
      body: { referto_id: referto.id },
    });

    if (error) {
      this.spiegazioneErrore.set('Errore nell\'analisi del referto. Riprova più tardi.');
      this.elaborazione.set(false);
      return;
    }

    // 3. Rilegge il risultato salvato dalla Edge Function nella tabella cache.
    const { data: risultato, error: erroreLettura } = await this.supabase.client
      .from('referti_spiegazioni')
      .select('testo')
      .eq('referto_id', referto.id)
      .maybeSingle();

    if (erroreLettura || !risultato) {
      this.spiegazioneErrore.set('Analisi completata ma errore nel recupero del risultato.');
      this.elaborazione.set(false);
      return;
    }

    this.parsaRisposta((risultato as any).testo);
    this.elaborazione.set(false);
  }
}
