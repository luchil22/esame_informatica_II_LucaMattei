# README_STUDIO — AttesaZero
## Guida di studio strutturata come presentazione orale

> Un solo file da rileggere prima dell'esame. Ogni capitolo è pensato come una **slide narrata**: prima la frase da pronunciare a voce, poi il dettaglio tecnico che ti tiene coperto se l'esaminatore approfondisce, infine le **domande tipiche** + risposta pronta.
>
> Se la commissione ti ferma su una riga di codice, apri il capitolo corrispondente e ricostruisci la risposta. La sequenza dei capitoli **è** l'ordine consigliato della presentazione.

---

## Indice (la scaletta della presentazione)

0. [Come usare questo file](#0-come-usare-questo-file)
1. [Slide 1 — Copertina e pitch in 60 secondi](#1-slide-1--copertina-e-pitch-in-60-secondi)
2. [Slide 2 — Problema e soluzione](#2-slide-2--problema-e-soluzione)
3. [Slide 3 — Stack tecnologico e perché](#3-slide-3--stack-tecnologico-e-perché)
4. [Slide 4 — Mappatura ai requisiti d'esame](#4-slide-4--mappatura-ai-requisiti-desame)
5. [Slide 5 — Architettura del codice (mappa)](#5-slide-5--architettura-del-codice-mappa)
6. [Slide 6 — Modello dati e RLS](#6-slide-6--modello-dati-e-rls)
7. [Slide 7 — Routing e Auth Guard](#7-slide-7--routing-e-auth-guard)
8. [Slide 8 — I servizi `core/`](#8-slide-8--i-servizi-core)
9. [Slide 9 — S1 Login](#9-slide-9--s1-login)
10. [Slide 10 — S2 Esplora](#10-slide-10--s2-esplora)
11. [Slide 11 — S3 Dashboard "Le Mie Attese"](#11-slide-11--s3-dashboard-le-mie-attese)
12. [Slide 12 — S4 Referti + AI](#12-slide-12--s4-referti--ai)
13. [Slide 13 — S5 Diritti & Tutela](#13-slide-13--s5-diritti--tutela)
14. [Slide 14 — S6 Pronto Soccorso (API esterna + trend)](#14-slide-14--s6-pronto-soccorso-api-esterna--trend)
15. [Slide 15 — Edge Function `spiega-referto`](#15-slide-15--edge-function-spiega-referto)
16. [Slide 16 — Sicurezza](#16-slide-16--sicurezza)
17. [Slide 17 — Accessibilità e UI](#17-slide-17--accessibilità-e-ui)
18. [Slide 18 — Pattern di codice ricorrenti](#18-slide-18--pattern-di-codice-ricorrenti)
19. [Demo live — script di click ordinato](#19-demo-live--script-di-click-ordinato)
20. [Q&A anticipato](#20-qa-anticipato)
21. [Glossario rapido](#21-glossario-rapido)
22. [Checklist finale](#22-checklist-finale)

---

## 0. Come usare questo file

- **Studio**: leggi tutto in ordine, ogni capitolo una volta.
- **Ripasso**: rileggi solo le frasi di apertura (in *corsivo*) di ogni capitolo + Q&A + checklist.
- **All'esame**: hai questo `.md` come "rete di sicurezza". Se ti chiedono di mostrare codice, vai sull'IDE e apri il file linkato; se ti chiedono di spiegare un concetto, racconta la versione orale e arricchisci.
- **Convenzione**: ogni capitolo ha questa forma:
  - *Pitch orale (≤30 s)*
  - **Cosa c'è / dove sta** (file + righe)
  - **Come funziona** (codice essenziale)
  - **Perché così** (le decisioni difendibili)
  - **Domande probabili** (con risposta pronta)

---

## 1. Slide 1 — Copertina e pitch in 60 secondi

> *"AttesaZero è un MVP web che rende leggibili i tempi di attesa sanitari della Provincia di Bolzano e dà all'utente uno strumento personale per tracciare le proprie attese, capire se ha diritto al rimborso, e contribuire con i giorni reali a un dataset community. Frontend Angular 21 standalone con Signals, backend Supabase (Postgres + Auth + Storage + Edge Function in Deno), UI con Tailwind CSS più un piccolo design system custom. Dati ASDAA ufficiali + un'API live Open Data della Provincia per i Pronto Soccorso."*

Da memorizzare *parola per parola*: serve a partire senza esitazioni.

**Numeri rapidi**:
- 6 schermate (1 sola statica, S5)
- 2 interazioni con modifica DB richieste, **2+ implementate** (vedi §4)
- 7 tabelle Postgres + 2 viste + 1 bucket Storage + 1 Edge Function
- 1 API esterna pubblica (Open Data Bolzano)
- ~6 service Angular, 1 guard, 6 page components standalone

---

## 2. Slide 2 — Problema e soluzione

### Il problema
Il cittadino altoatesino vuole sapere:
1. **Quanto aspetterò** per un esame/visita? (dato ASDAA disperso in Excel mensili sul sito istituzionale, difficile da consultare)
2. **Sto rispettando i tempi di legge** sulla mia prenotazione? Posso chiedere il rimborso in struttura privata?
3. **Quanto è affollato il Pronto Soccorso ora**?
4. **Cosa dice il mio referto** in linguaggio semplice?

### La soluzione (mappata sulle 6 schermate)

| Schermata | Bisogno coperto |
|---|---|
| **S2 Esplora** | Vedo i tempi medi ufficiali per qualunque prestazione, filtrabili per priorità. |
| **S3 Dashboard** | Traccio le mie prenotazioni, vedo un semaforo (verde/giallo/rosso) rispetto alle soglie di legge, ricevo un alert quando ho diritto al rimborso. |
| **S6 Pronto Soccorso** | Vedo in tempo reale le code di tutti i PS provinciali + un trend ("+20% nell'ultima ora") calcolato in locale. |
| **S4 Referti** | Carico un PDF privato e ricevo da Gemini un riassunto in italiano semplice + valori chiave + domande utili. |
| **S5 Diritti** | Pagina informativa sui diritti del paziente in lista d'attesa. |
| **S1 Login** | Identità necessaria per S3 e S4. |

### Valore aggiunto rispetto al sito ufficiale ASDAA
- Ricerca testuale (oggi è solo download Excel mese per mese).
- Personalizzazione (le mie attese, semaforo, rimborso).
- Crowdsourcing (dato reale vissuto, alimenta `recensioni_attesa`).
- Trend storico locale dei PS (lo stato ufficiale è solo puntuale).
- AI assistente sui referti.

---

## 3. Slide 3 — Stack tecnologico e perché

| Layer | Scelta | Motivo difendibile all'orale |
|---|---|---|
| Frontend framework | **Angular 21** standalone + Signals | Modifica concordata col docente al posto di VueJS. Standalone + Signals = pattern moderno, niente NgModule, niente RxJS, codice spiegabile riga per riga. |
| UI / Stile | **Tailwind CSS 3** + design system custom (`az-*`) | Utility-first → niente CSS sparso, classi inline leggibili nei template. Sopra Tailwind ho aggiunto poche variabili e classi `az-*` per identità visuale (colori brand, card, bottoni). |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions) | Un solo provider per DB, login, file storage e funzioni serverless. RLS di Postgres = sicurezza dichiarativa nel DB, non a livello applicativo. |
| Linguaggio Edge | **Deno + TypeScript** | Runtime nativo di Supabase Functions. Stesso linguaggio del frontend. |
| AI | **Google Gemini** (`gemini-2.5-flash-lite` con fallback) | Free tier generoso, supporta input PDF in base64 nativo, latenza bassa col modello "lite". |
| Dati esterni | **Open Data Provincia BZ** `PS_Queue/json` | API pubblica, JSON, CORS aperto → si chiama dal browser senza proxy. |

> **Da dire subito** se l'esaminatore alza un sopracciglio sentendo Angular: *"Il syllabus prevedeva VueJS, ma ho concordato con il docente di usare Angular per esplorare l'architettura standalone con Signals, che è concettualmente vicina alla Composition API di Vue 3."*

### Cosa NON ho usato (e perché vale la pena dirlo)
- **Nessun `NgModule`** → la 21 lo permette, l'app parte solo da `appConfig`.
- **Nessun RxJS complesso** → solo `async/await`. Niente `switchMap`/`mergeMap` da spiegare.
- **Nessun NgRx / Pinia / Redux** → state locale nel componente con `signal`.
- **Nessun Bootstrap/Material/PrimeNG** → solo Tailwind + classi custom.

---

## 4. Slide 4 — Mappatura ai requisiti d'esame

Questa è la **prima cosa** che probabilmente ti chiederanno. Sapere riga per riga.

| Requisito di esame | Implementazione concreta | File chiave |
|---|---|---|
| ≥ 5 schermate, max 1 statica | 6 schermate. **Solo S5** è statica. | `src/app/pages/` |
| Login utente | Supabase Auth, email+password, conferma via email | `auth.service.ts`, `login.component.ts` |
| ≥ 2 interazioni con modifica DB | **(a)** INSERT `attese_utente` da form S3 (+ INSERT `recensioni_attesa` + DELETE `attese_utente` al completamento). **(b)** Upload PDF su bucket Storage + INSERT in `referti` da S4 (+ DELETE a 3 step). | `dashboard.component.ts:salvaAttesa`, `attese.service.ts:completa`, `referti.component.ts:caricaReferto` |
| DB in lettura **e** scrittura | Letture: `v_ultime_attese`, `attese_utente`, `referti`, `referti_spiegazioni`. Scritture: `attese_utente` (INSERT+DELETE), `recensioni_attesa` (INSERT), `referti` (INSERT+DELETE), Storage `referti` (upload+remove), `referti_spiegazioni` (DELETE da client, INSERT da Edge Function). | tutto sparso, ma con orchestrazione nei service |
| Uso API esterna | `https://dati.retecivica.bz.it/services/PS_Queue/json` chiamata in `fetch()` dal client | `pronto-soccorso.service.ts` |
| Responsiveness | Utility responsive Tailwind (`sm:`, `md:`, `lg:`) + design custom `az-*` + sidebar che collassa | `app.html`, `app.scss`, template di tutte le pagine |
| Accessibilità | `aria-label`, `alt`, `role="alert"`, `role="status"`, `.visually-hidden`, navigazione completa da tastiera | template di tutte le pagine |
| Framework concordato | Angular al posto di Vue, autorizzato dal docente | — |

### Come argomentare "2 interazioni" se l'esaminatore obietta
- L'interazione 1 in realtà è **due scritture concatenate** in due momenti diversi (salvo l'attesa → poi la completo). Conta una sola perché è un'unica feature concettuale, ma se devi mostrare *tre punti di scrittura distinti* puoi separarle.
- L'interazione 2 è un upload **binario** sullo Storage + un **INSERT** sui metadati: già due chiamate diverse al backend.

---

## 5. Slide 5 — Architettura del codice (mappa)

```
src/app/
├── app.ts / app.html / app.scss          # root: sidebar + <router-outlet>
├── app.config.ts                          # provider radice (provideRouter, ecc.)
├── app.routes.ts                          # 6 rotte + redirect + wildcard
├── core/services/                         # tutto ciò che parla col mondo esterno
│   ├── supabase.service.ts                # singleton: SupabaseClient
│   ├── auth.service.ts                    # login/registra/logout + signal sessione
│   ├── prestazioni.service.ts             # SELECT su v_ultime_attese
│   ├── pronto-soccorso.service.ts         # fetch API esterna + normalizza bilingue
│   ├── ps-history.service.ts              # snapshot in localStorage + trend PS
│   └── attese.service.ts                  # CRUD attese_utente + flusso completa()
├── guards/
│   └── auth.guard.ts                      # CanActivateFn: protegge /dashboard e /referti
└── pages/                                 # una cartella per schermata
    ├── login/                             # S1 — pubblica
    ├── esplora/                           # S2 — pubblica (sola lettura)
    ├── dashboard/                         # S3 — privata (hub "Le Mie Attese")
    ├── referti/                           # S4 — privata (upload PDF + AI)
    ├── diritti/                           # S5 — statica pubblica
    └── pronto-soccorso/                   # S6 — pubblica (API + trend)
supabase/
├── migrations/
│   └── 20260512_attese_utente.sql         # schema + RLS della tabella attese_utente
└── functions/spiega-referto/
    └── index.ts                           # Edge Function Deno → Gemini
references/
└── data-architecture.md                   # schema DB completo
```

### Diagramma a blocchi (da disegnare a voce)

```
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER (Angular 21)                     │
│                                                                 │
│  pages/  ←→  core/services/  ←→  SupabaseClient (anon key)      │
│                                                                 │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             │ fetch()                       │ HTTPS + JWT
             ▼                               ▼
┌──────────────────────────┐   ┌────────────────────────────────┐
│  Open Data Provincia BZ  │   │           SUPABASE             │
│   /services/PS_Queue/    │   │                                │
└──────────────────────────┘   │  ┌──────────┐  ┌────────────┐  │
                               │  │ Postgres │  │   Auth     │  │
                               │  │ + RLS    │  │  (email)   │  │
                               │  └──────────┘  └────────────┘  │
                               │  ┌──────────┐  ┌────────────┐  │
                               │  │ Storage  │  │   Edge     │  │
                               │  │ referti/ │  │  Function  │──┼──→ Gemini API
                               │  └──────────┘  └────────────┘  │
                               └────────────────────────────────┘
```

### Principi di organizzazione
- **`core/services` ≡ tutto ciò che parla col mondo esterno**. Un componente non sa cosa sia un `SupabaseClient`: chiede al service. Permette in teoria di cambiare backend senza toccare la UI.
- **`guards` ≡ politiche di accesso**. Una funzione `CanActivateFn` per rotta. Niente logica di auth dentro i componenti.
- **`pages` ≡ una cartella per schermata** con `.ts` + `.html`. Niente `.scss` di pagina: stili globali in `app.scss` o classi Tailwind/`az-*` inline.

### Standalone vs NgModule
Da Angular 17 i componenti dichiarano direttamente i propri `imports`. Da Angular 21 nemmeno l'app radice ha bisogno di un module: bastano i provider in `app.config.ts`. Vantaggio per l'orale: meno boilerplate, "vedi tutto in un file".

### Signals (Angular 16+)
Un `signal<T>` è una funzione: la chiami senza argomenti per **leggere** (`this.errore()`), con argomento per **scrivere** (`this.errore.set('...')`). Il template si aggiorna da solo quando un signal letto al suo interno cambia. Niente subscribe, niente leak, niente `async` pipe.

`computed()` deriva un valore da altri signal. Esempio: `risultatiFiltrati = computed(() => …)` in `esplora.component.ts` si ricalcola da solo quando cambia `risultati()` o `prioritaFiltro()`.

---

## 6. Slide 6 — Modello dati e RLS

> *"Sette tabelle Postgres, due viste, un bucket Storage. Tutto separato in due gruppi: dati pubblici (tempi ASDAA, dizionario priorità, vista community) e dati privati (attese personali, referti, spiegazioni AI). I dati privati sono protetti da Row Level Security: ogni policy dice 'la riga è tua se `auth.uid() = user_id`'."*

Documentazione integrale: [references/data-architecture.md](references/data-architecture.md). Riassunto operativo qui sotto.

### Tabelle pubbliche (no login)

| Tabella / Vista | Cosa contiene | Usata in |
|---|---|---|
| `tempi_attesa_asdaa` | 252 record seed: tempi medi ufficiali ASDAA feb 2026 | (sorgente, non letta direttamente dal client) |
| `v_ultime_attese` | Vista: solo righe con `tempo_medio_attesa` non nullo | **S2** |
| `v_tempi_attesa_community` | Vista aggregata: media `giorni_attesa_reali` dalle recensioni | (estensione futura) |
| `dizionario_priorita` | Mappa codice priorità → descrizione e soglia | (consultata in S5 ma S5 è hard-coded) |
| `pronto_soccorso_status` | **Dormiente** nell'MVP. S6 chiama l'API live direttamente. | — |

### Tabelle private (RLS: `auth.uid() = user_id`)

| Tabella | Operazioni | Schermata |
|---|---|---|
| `attese_utente` | SELECT + **INSERT** + DELETE | S3 |
| `recensioni_attesa` | **INSERT** (al completamento attesa) | S3 (via `AttesaService.completa()`) |
| `referti` | SELECT + **INSERT** + DELETE | S4 + widget S3 |
| `referti_spiegazioni` | SELECT (proprio) + DELETE. **INSERT solo da Edge Function (service_role)** | S4 |

### Le costanti di dominio da ricordare

| Codice priorità | Etichetta | Giorni max di legge |
|---|---|---|
| `U` | Urgente | 3 |
| `B` | Breve | 10 |
| `D` | Differibile | 30 |
| `P` | Programmabile | 120 |

> Il seed ASDAA contiene solo `B`, `D`, `P`. La `U` esiste nel dizionario per completezza informativa (mostrata in S5).

### Cos'è RLS, in due frasi
Row Level Security è una feature di Postgres: per ogni tabella scrivi delle **policy** che decidono quali righe un dato ruolo può leggere/scrivere. Supabase espone il JWT dell'utente come `auth.uid()` dentro la policy, e propaga il ruolo `anon` (anonimo) o `authenticated` (loggato) in base al token in `Authorization`. Esempio della migrazione [`20260512_attese_utente.sql`](supabase/migrations/20260512_attese_utente.sql):

```sql
CREATE POLICY attese_utente_select_own ON public.attese_utente FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY attese_utente_insert_own ON public.attese_utente FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY attese_utente_update_own ON public.attese_utente FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY attese_utente_delete_own ON public.attese_utente FOR DELETE
  USING (auth.uid() = user_id);
```

- **`USING`** filtra le righe leggibili (SELECT / UPDATE / DELETE).
- **`WITH CHECK`** filtra le righe scrivibili (INSERT / UPDATE).

Se il client tenta `INSERT` con un `user_id` diverso dal proprio, **la policy rifiuta in DB**. La sicurezza è lato server, sempre.

### Storage bucket `referti`
- Privato (no URL pubblico).
- Path convenzionale: `{auth.uid()}/{timestamp}-{uuid}-{nomeSanitizzato}.pdf`.
- Policy bucket: scrittura/lettura solo dentro la cartella che ha nome = `auth.uid()::text`.
- Visualizzazione PDF nel browser: **signed URL** temporanei (`createSignedUrl(path, 3600)`), embeddati in `<iframe>` con `bypassSecurityTrustResourceUrl`.

---

## 7. Slide 7 — Routing e Auth Guard

[src/app/app.routes.ts](src/app/app.routes.ts)

```ts
{ path: '',                redirectTo: 'esplora', pathMatch: 'full' },
{ path: 'login',           loadComponent: () => import('...') },
{ path: 'esplora',         loadComponent: () => import('...') },
{ path: 'pronto-soccorso', loadComponent: () => import('...') },
{ path: 'diritti',         loadComponent: () => import('...') },
{ path: 'dashboard',       loadComponent: () => import('...'), canActivate: [authGuard] },
{ path: 'referti',         loadComponent: () => import('...'), canActivate: [authGuard] },
{ path: '**',              redirectTo: 'esplora' },
```

Cose da saper dire:
- **`loadComponent`** = lazy loading. Il bundle JS della pagina si scarica solo quando l'utente ci naviga. Per un MVP serve poco, ma è la pratica standard.
- **`pathMatch: 'full'`** sul redirect della rotta vuota: senza, il match scatterebbe per qualunque URL (perché ogni URL inizia con stringa vuota). Va specificato solo sui redirect.
- **Wildcard `**`** in fondo: cattura URL inesistenti e li manda su `/esplora`. Niente 404 nudi.
- **`canActivate: [authGuard]`**: la guard è una *funzione* `CanActivateFn`, non una classe.

### Auth Guard

[src/app/guards/auth.guard.ts](src/app/guards/auth.guard.ts)

```ts
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  await auth.sessioneCaricata;
  if (auth.sessione()) return true;
  router.navigate(['/login']);
  return false;
};
```

Tre dettagli da difendere:
1. È una **funzione**, non una classe. Da Angular 14 questa è la forma preferita.
2. **`inject()`** ottiene un servizio fuori da un componente. Equivalente del `constructor(private auth: AuthService)`.
3. **`await auth.sessioneCaricata`** è la riga chiave: quando ricarichi `/dashboard`, Supabase deve leggere il JWT dal `localStorage` per ricostruire la sessione, ed è asincrono. Senza l'`await` la guard scatterebbe prima che `getSession()` finisca, vedrebbe `sessione() === null`, e ti butterebbe fuori. La promise `sessioneCaricata` si risolve quando `getSession()` ha completato.

---

## 8. Slide 8 — I servizi `core/`

### 8.1 `SupabaseService`
[src/app/core/services/supabase.service.ts](src/app/core/services/supabase.service.ts)

```ts
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;
  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
}
```

- **`providedIn: 'root'`** = singleton, una sola istanza in tutta l'app, così la sessione di auth resta condivisa fra tutti i componenti che iniettano il service.
- La chiave è la **anon/publishable key**: pubblica per design. La sicurezza non sta nel nasconderla, sta nelle policy RLS di Postgres.

### 8.2 `AuthService`
[src/app/core/services/auth.service.ts](src/app/core/services/auth.service.ts)

```ts
sessione         = signal<Session | null>(null);
sessioneCaricata: Promise<void>;

constructor(private supabase: SupabaseService) {
  this.sessioneCaricata = this.supabase.client.auth.getSession().then(({ data }) => {
    this.sessione.set(data.session);
  });
  this.supabase.client.auth.onAuthStateChange((_event, session) => {
    this.sessione.set(session);
  });
}
```

Due meccanismi in coppia:
1. **`getSession()`** legge la sessione corrente (può essere in `localStorage` da un login precedente). Ne salviamo la Promise come `sessioneCaricata` per la guard.
2. **`onAuthStateChange()`** è un listener: ogni volta che la sessione cambia (login, logout, refresh JWT) aggiorna il signal. È ciò che fa apparire/scomparire il bottone "Esci" senza ricarichi.

I metodi `login`/`registra`/`logout` restituiscono una **stringa di errore** (o stringa vuota se ok), invece di sollevare eccezioni: il componente fa un `if (err)` invece di un `try/catch`. Scelta di leggibilità sopra purezza.

### 8.3 `PrestazioniService`
[src/app/core/services/prestazioni.service.ts](src/app/core/services/prestazioni.service.ts)

Due metodi, entrambi leggono la vista `v_ultime_attese`:
- `cercaPrestazioni(termine)` → `.ilike('prestazione', '%termine%')`. La `i` di `ilike` = case-insensitive. Niente SQL injection: il client Supabase passa il valore come parametro (PostgREST + prepared statements), non come concatenazione.
- `caricaTutte()` → primo caricamento, limitato a 50 (`.limit(50)`).

Entrambi restituiscono `{ data, error }` con `error` già tradotto in italiano leggibile.

### 8.4 `ProntoSoccorsoService`
[src/app/core/services/pronto-soccorso.service.ts](src/app/core/services/pronto-soccorso.service.ts)

Unico service che **non parla con Supabase**: chiama direttamente l'API Open Data.

```ts
const API_URL  = 'https://dati.retecivica.bz.it/services/PS_Queue/json';
const response = await fetch(API_URL);
```

- **Normalizzazione bilingue**: l'API risponde `"Bolzano/Bozen"`, `"Bianco/Weiss"`. `.split('/')[0].trim()` tiene solo l'italiano. Scelta di prodotto: l'app è in italiano, raddoppiare le etichette sarebbe rumore.
- **`try/catch`** attorno al `fetch`: errori di rete diventano stringa italiana, niente eccezione propagata.

> **Nota orale**: la tabella `pronto_soccorso_status` esiste nello schema ma **non è popolata da nessun job**: è "dormiente". S6 chiama l'API direttamente dal browser. Se chiedono perché: *"semplicità — niente cron, niente sync, una chiamata HTTP in meno"*.

### 8.5 `PsHistoryService` *(nuovo)*
[src/app/core/services/ps-history.service.ts](src/app/core/services/ps-history.service.ts)

Valore aggiunto rispetto al sito ASDAA ufficiale: oltre allo stato puntuale, S6 mostra un **trend** ("+20% nell'ultima ora") per ogni ospedale. Il trend è calcolato in **locale**, da `localStorage`: nessuna scrittura su Supabase, niente costo backend, dato per-dispositivo.

Pattern (semplificato):

```ts
salvaSnapshot(totali: Record<string, number>): void {
  const storico = this.leggiStorico();
  storico.push({ ts: Date.now(), totali });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(storico.slice(-MAX_SNAPSHOTS)));
}

calcolaTrend(codice: string, totaleAttuale: number): PsTrend | null {
  // cerca uno snapshot tra 25 e 75 minuti fa
  // calcola delta assoluto e percentuale
  // sotto soglia 8% → 'stable', altrimenti 'up' / 'down'
}
```

Cose da saper spiegare:
- **Chiave versionata**: `attesazero_ps_history_v1`. Se cambia lo schema dello snapshot, basta bumpare `v1` → `v2` e i dati vecchi vengono ignorati senza crash.
- **`MAX_SNAPSHOTS = 50`**: con refresh ogni ~5 min coprono ~4 ore. Sliding window via `slice(-50)`.
- **Finestra `[25, 75] min`** per il candidato di confronto: troppo recente = rumore, troppo vecchio = informazione obsoleta. Sweet spot ~1 ora indietro.
- **Soglia di stabilità 8%**: evita di urlare "+20%" quando in realtà sono 2 pazienti in più su 10 (rumore statistico).
- **`Math.max(totalePassato, 1)`** nel calcolo %: previene divisione per zero quando l'ospedale era vuoto.
- **`Math.abs(deltaPct) < STABLE`** invece di due `if` separati: stabilità simmetrica, ±8% è stabile in entrambe le direzioni.

### 8.6 `AttesaService`
[src/app/core/services/attese.service.ts](src/app/core/services/attese.service.ts)

Il service che incarna la **prima delle due interazioni con modifica dati**. Espone CRUD su `attese_utente` + un metodo puro `calcolaStato` che arricchisce ogni riga con campi derivati (giorni passati, semaforo, diritto al rimborso).

```ts
const SOGLIE: Record<string, number> = { U: 3, B: 10, D: 30, P: 120 };

export interface AttesaCalcolata extends AttesaUtente {
  giorniMaxLegge:  number;
  giorniPassati:   number;
  giorniRimanenti: number;
  stato:           'verde' | 'giallo' | 'rosso';
  dirittoRimborso: boolean;
}
```

| Metodo | Cosa fa | DB |
|---|---|---|
| `caricaTutte()` | SELECT delle proprie attese ordinate per `data_prenotazione` | LETTURA `attese_utente` (RLS USING) |
| `inserisci(attesa)` | INSERT nuova attesa, `user_id` impostato dal service | SCRITTURA `attese_utente` (RLS WITH CHECK) |
| `elimina(id)` | DELETE per id | SCRITTURA `attese_utente` (RLS USING) |
| `completa(attesa, gg)` | INSERT `recensioni_attesa`, poi DELETE su `attese_utente` | SCRITTURA su due tabelle |
| `calcolaStato(attesa)` | Pura: ritorna `AttesaCalcolata` con semaforo e `dirittoRimborso` | — |
| `giorniDa(dataIso)` | Pura: giorni tra `dataIso` e oggi | — |

Punti delicati:
- **`completa()` non è transazionale**: se la prima INSERT fallisce, l'attesa resta. Se la prima riesce ma la DELETE fallisce, hai una recensione e un'attesa "fantasma". Compromesso MVP: una transazione vera richiederebbe una RPC Postgres dedicata.
- **`calcolaStato` non tocca il DB**: trasforma una riga grezza in una "decorata" usando `SOGLIE` e `new Date()`. Si chiama nel `.map()` del componente dopo ogni `caricaTutte()`.
- **Semaforo**: `rosso` se `giorniRimanenti < 0` (soglia superata → diritto al rimborso); `giallo` se manca ≤ 25% della soglia; `verde` altrimenti.

---

## 9. Slide 9 — S1 Login

[src/app/pages/login/login.component.ts](src/app/pages/login/login.component.ts)

> *"Form con email e password, un toggle che alterna la modalità login e registrazione. Sotto il cofano chiama `AuthService.login()` o `AuthService.registra()`. Mostro un messaggio generico in caso di errore per non rivelare se l'email esiste già (anti enumeration)."*

Pattern del metodo `accedi()`:
```ts
this.caricamento.set(true);
this.errore.set('');
const errMsg = await this.auth.login(this.email(), this.password());
if (errMsg) { this.errore.set('Email o password non corretti'); this.caricamento.set(false); return; }
this.caricamento.set(false);
this.router.navigate(['/dashboard']);
```

**Domande probabili**
- *Come fai il two-way binding?* → `[(ngModel)]` con `FormsModule` importato nel componente standalone (o `[value]` + `(input)` con signal).
- *Cosa succede dopo la registrazione?* → Supabase invia una email di conferma con un link. Solo dopo il click il login viene abilitato.
- *Perché un messaggio generico?* → Sicurezza: non voglio rivelare se l'email è già registrata (account enumeration).

---

## 10. Slide 10 — S2 Esplora

[src/app/pages/esplora/esplora.component.ts](src/app/pages/esplora/esplora.component.ts)

> *"Schermata pubblica di sola lettura sui tempi ASDAA. L'utente cerca per nome prestazione, filtra per priorità lato client. Se è loggato, ogni riga ha un bottone 'Aggiungi alle mie attese' che porta a S3 con il form precompilato via query param."*

Stato:
```ts
risultati         = signal<TempoAttesa[]>([]);
termineCerca      = signal('');
prioritaFiltro    = signal('');
risultatiFiltrati = computed(() => /* filtro client-side */);
```

Tre flussi:
1. **`ngOnInit` → `caricaTutte()`**: primo render carica 50 prestazioni.
2. **`cerca()`**: l'utente preme "Cerca", parte `PrestazioniService.cercaPrestazioni(termine)`.
3. **Filtro priorità**: `computed` puro client-side, non rifà la query.

### Decisione di design importante
Inizialmente il form di inserimento recensione stava su S2. È stato spostato su S3 perché:
- L'utente "esplora" prima di sapere quanto ha aspettato.
- Più realistico chiedere il dato **a posteriori**, quando completa una visita.
- Genera recensioni più affidabili (giorni calcolati, non a memoria).
- Soddisfa un caso d'uso reale: tracking del rimborso.

Il bottone "Aggiungi alle mie attese" appare solo se `isLoggato()`. È un semplice `routerLink` con `[queryParams]`: la INSERT vera avviene su S3.

---

## 11. Slide 11 — S3 Dashboard "Le Mie Attese"

[src/app/pages/dashboard/dashboard.component.ts](src/app/pages/dashboard/dashboard.component.ts)

> *"Hub centrale dell'app loggata. Qui sta la prima delle due interazioni di modifica DB richieste dall'esame: l'utente aggiunge un'attesa, vede un semaforo verde/giallo/rosso rispetto alla soglia di legge della priorità, e quando la visita è effettuata dichiara i giorni reali. Quel dato finisce in `recensioni_attesa` (community) e l'attesa viene rimossa."*

Stato principale:
```ts
attese  = signal<AttesaCalcolata[]>([]);
referti = signal<Referto[]>([]);                  // widget: ultimi 3 referti

mostraForm       = signal(false);
prestazione      = signal('');
priorita         = signal('B');
dataPrenotazione = signal('');
struttura        = signal('');

attesaInCompletamento = signal<AttesaCalcolata | null>(null);
giorniReali           = signal<number | null>(null);

conteggioRosso = computed(() => this.attese().filter(a => a.stato === 'rosso').length);
```

### A) Init parallelo

```ts
async ngOnInit(): Promise<void> {
  this.preimpostaFormDaQueryParam();
  await Promise.all([this.caricaAttese(), this.caricaRefertiRecenti()]);
}
```

- **`preimpostaFormDaQueryParam`**: se l'utente arriva da S2 con `?prestazione=...&priorita=...`, prepopola il form e lo apre. Continuità UX.
- **`Promise.all`**: attese e widget referti sono query indipendenti su tabelle diverse → partono in parallelo, dimezzo la latenza.

### B) Interazione 1 — `salvaAttesa()`

```ts
async salvaAttesa(): Promise<void> {
  this.errore.set(''); this.successo.set('');

  if (!this.prestazione() || !this.dataPrenotazione()) {
    this.errore.set('Compila prestazione e data di prenotazione.');
    return;
  }

  const err = await this.attesaService.inserisci({
    prestazione:       this.prestazione(),
    priorita:          this.priorita(),
    data_prenotazione: this.dataPrenotazione(),
    struttura:         this.struttura() || null,
  });

  if (err) { this.errore.set(err); return; }

  this.successo.set('Attesa aggiunta.');
  this.resettaForm();
  await this.caricaAttese();
}
```

Punti chiave:
- **Componente non parla mai col `SupabaseClient`** per `attese_utente`: tutto passa per il service.
- **`user_id` impostato dal service**, mai dal componente. La RLS controlla `auth.uid() = user_id`.
- **Re-fetch dopo la scrittura**: pattern "stupido ma corretto", spiegabile in 10 secondi.

### C) Interazione 1-bis — `confermaCompletamento()`

L'utente clicca "Visita effettuata" su una card, si apre una modale con `giorniReali` pre-impostato a `giorniPassati`. Confermando:

```ts
const err = await this.attesaService.completa(a, gg);
```

Sotto il cofano (`AttesaService.completa`):
1. **INSERT** su `recensioni_attesa` con `prestazione`, `priorita`, `giorni_attesa_reali`, `struttura`.
2. **DELETE** della riga in `attese_utente` (solo se la INSERT è andata a buon fine).

Chiude il ciclo "prenoto → aspetto → contribuisco al dataset community".

### D) Eliminazione attesa
`confirm()` nativo (zero dipendenze), poi `AttesaService.elimina(id)`. La RLS garantisce che non si possa eliminare l'attesa di un altro utente: anche se il client truccasse l'id, la DELETE non match no row.

### E) Widget "Referti recenti"
Query inline (non passa da un service dedicato perché serve solo qui e tre campi):
```ts
await this.supabase.client
  .from('referti')
  .select('id, nome_file, created_at')
  .eq('user_id', this.auth.getUserId())
  .order('created_at', { ascending: false })
  .limit(3);
```
Errore ignorato silenziosamente: se il widget fallisce, la dashboard funziona comunque.

### F) Render helpers
`coloreBadge`, `testoStato`, `etichettaPriorita` → stringhe formattate per UI. Da dire all'orale: *"helper di formattazione, no logica di dominio"*.

---

## 12. Slide 12 — S4 Referti + AI

[src/app/pages/referti/referti.component.ts](src/app/pages/referti/referti.component.ts)

> *"Seconda interazione con modifica DB richiesta dall'esame: upload di un PDF nel bucket Storage privato + INSERT nella tabella `referti`. In aggiunta, l'utente può chiedere all'AI di spiegare il referto, ma solo dopo aver dato un consenso esplicito: il file viene mandato a Gemini tramite un'Edge Function in Deno."*

Tre macro-aree.

### A) Upload (l'interazione "modifica dati" n.2)

```ts
async caricaReferto(): Promise<void> {
  const file = this.fileScelto();
  if (!file) return;
  this.uploading.set(true);

  // 1. file → Storage bucket 'referti'
  const percorso = `${this.auth.getUserId()}/${file.name}`;
  const { error: erroreStorage } = await this.supabase.client
    .storage.from('referti').upload(percorso, file);
  if (erroreStorage) { /* gestione */ return; }

  // 2. metadati → tabella `referti`
  const { error: erroreDb } = await this.supabase.client
    .from('referti')
    .insert({ user_id: this.auth.getUserId(), nome_file: file.name, storage_path: percorso });
  if (erroreDb) { /* gestione */ return; }

  this.successo.set('Referto caricato con successo!');
  await this.caricaReferti();
}
```

Sequenza importante per l'orale:
1. **Upload binario** nel bucket Storage, sottocartella `{userId}/`. Policy bucket: `auth.uid() = (storage.foldername(name))[1]::uuid` → ognuno scrive solo nella propria cartella.
2. **INSERT metadati** in `referti`. Storage e DB sono separati: Storage tiene il blob, la tabella tiene puntatori queryabili in SQL.
3. **Re-fetch** della lista.

**Validazione PDF lato client**: dimensione ≤ 10 MB, MIME `application/pdf`, magic bytes iniziali `%PDF` (0x25 0x50 0x44 0x46), nome file sanitizzato a `[a-zA-Z0-9._-]{1,100}`.

**Drag-and-drop**: handler DOM standard (`onDragOver`/`onDragLeave`/`onDrop`) + 3 signal UX (`fileScelto`, `dragSopra`, `uploading`).

> **Domanda quasi certa**: *"Perché non basta lo Storage, perché serve anche la tabella?"* → Lo Storage non è queryabile in SQL: niente JOIN, niente ordinamento, niente RLS basate su altre tabelle. La tabella `referti` dà metadati strutturati (`created_at`, `nome_file`, `id` usato come FK in `referti_spiegazioni`).

### B) Eliminazione a 3 step

```ts
async eliminaReferto(referto: Referto) {
  // 1. cache spiegazione AI (FK → referto)
  await this.supabase.client.from('referti_spiegazioni').delete().eq('referto_id', referto.id);
  // 2. file Storage
  await this.supabase.client.storage.from('referti').remove([referto.storage_path]);
  // 3. record DB principale
  await this.supabase.client.from('referti').delete().eq('id', referto.id);
}
```

L'ordine conta: prima la cache (foreign key), poi il file, poi il record principale. Se uno step fallisce mostriamo errore ma non rolliamo back (richiederebbe transazione server-side).

> **NB**: in Postgres `ON DELETE CASCADE` su `referti_spiegazioni.referto_id` farebbe il primo step in automatico. Lo facciamo a mano lo stesso per controllo esplicito sui messaggi di errore.

### C) Analisi AI con consenso esplicito

```ts
async analizzaReferto() {
  if (!this.consensoDato()) return;

  // 1. cache?
  const { data: cache } = await this.supabase.client
    .from('referti_spiegazioni').select('testo')
    .eq('referto_id', referto.id).maybeSingle();
  if (cache) { this.parsaRisposta(cache.testo); return; }

  // 2. chiama Edge Function
  const { error } = await this.supabase.client.functions.invoke('spiega-referto', {
    body: { referto_id: referto.id },
  });

  // 3. rilegge il risultato che la Edge Function ha salvato in cache
  const { data: risultato } = await this.supabase.client
    .from('referti_spiegazioni').select('testo')
    .eq('referto_id', referto.id).maybeSingle();

  this.parsaRisposta(risultato.testo);
}
```

Punti orale:
- **Cache-first**: secondo click sullo stesso referto = zero costo, zero latenza.
- **`maybeSingle()`** vs `.single()`: ritorna `null` invece di errore se non c'è la riga.
- **Consenso esplicito** (`consensoDato`): checkbox bloccante. Il file finisce in pasto a un LLM di terze parti → opt-in (GDPR + buon senso).
- **`parsaRisposta`**: prova a estrarre un blocco JSON dalla risposta del modello, fallback su testo grezzo. *"Il modello dovrebbe rispondere in JSON ma non sempre rispetta lo schema: degradiamo gracefully."*
- **Preview PDF**: `createSignedUrl(storagePath, 3600)` → URL temporaneo (1h) per `<iframe>`. Il bucket resta privato. `bypassSecurityTrustResourceUrl` serve perché Angular blocca URL "non sicuri" nei `[src]`.

---

## 13. Slide 13 — S5 Diritti & Tutela

[src/app/pages/diritti/diritti.component.ts](src/app/pages/diritti/diritti.component.ts)

> *"L'unica schermata statica ammessa dal regolamento. Array hard-coded di 4 priorità (U/B/D/P) renderizzato come tabella. Zero logica."*

Perché esiste:
- Soddisfa il vincolo "max 1 statica".
- Dà contesto informativo sull'app (cosa significano i codici di priorità).
- Copre un bisogno reale: educazione del paziente sui propri diritti in attesa.

---

## 14. Slide 14 — S6 Pronto Soccorso (API esterna + trend)

[src/app/pages/pronto-soccorso/pronto-soccorso.component.ts](src/app/pages/pronto-soccorso/pronto-soccorso.component.ts)

> *"Schermata pubblica che soddisfa il requisito 'API esterna'. Chiama l'Open Data della Provincia, raggruppa le 35 righe (7 ospedali × 5 triage) per ospedale, ordina per affollamento decrescente, e calcola un trend locale ('+20% nell'ultima ora') usando snapshot in localStorage. Niente Supabase qui."*

Pattern di `caricaDati()`:
```ts
const { data, error } = await this.psService.caricaStatus();
if (error) { /* gestione */ }

const gruppi = this.raggruppaPerOspedale(data);

// totali per snapshot e per trend
const totali: Record<string, number> = {};
for (const g of gruppi) totali[g.codice] = this.totalePazienti(g);

// CALCOLA i trend PRIMA di salvare il nuovo snapshot
const trends: Record<string, PsTrend | null> = {};
for (const g of gruppi) trends[g.codice] = this.historyService.calcolaTrend(g.codice, totali[g.codice]);
this.trends.set(trends);

// poi salva lo snapshot
this.historyService.salvaSnapshot(totali);

// ordina per affollamento decrescente
gruppi.sort((a, b) => this.totalePazienti(b) - this.totalePazienti(a));
this.ospedali.set(gruppi);
```

Da saper spiegare:
- **`Map` invece di oggetto plain** per il raggruppamento: ordine di inserimento garantito, API più chiara (`has`, `get`, `set`).
- **Codici triage in stringa** (`'1'`...`'5'`): vengono dall'API così. Non li convertiamo in numero perché sono identificativi categorici.
- **Ordine: calcola trend → salva snapshot**. Se salvassi prima, il confronto userebbe come "passato" un dato appena scritto → trend sempre `stable`.
- **Soglie di affollamento ospedale**: `< 10 = basso`, `10-19 = medio`, `≥ 20 = alto`. Scelte sul dato osservato (la maggior parte degli ospedali ha 0-15 pazienti).
- **Mappa colori triage** `TRIAGE_COLORS`: costante a top di file. Rosso/arancio/verde/azzurro/grigio.

---

## 15. Slide 15 — Edge Function `spiega-referto`

[supabase/functions/spiega-referto/index.ts](supabase/functions/spiega-referto/index.ts)

> *"Funzione serverless in Deno. Riceve un `referto_id`, legge il path del PDF dalla tabella `referti`, lo scarica dal bucket, lo manda a Gemini in base64, e salva la risposta in `referti_spiegazioni`. Usa la Service Role Key perché deve scrivere in una tabella che l'utente, di proposito, non può scrivere direttamente."*

### Flusso

```
client (POST { referto_id })
   │
   ▼
Edge Function (Deno, service_role)
   │
   ├─ SELECT storage_path FROM referti WHERE id = ?
   ├─ storage.download(storage_path)
   ├─ arrayBuffer → base64
   ├─ POST https://generativelanguage.googleapis.com/...:generateContent
   │  con prompt JSON-structured + inlineData (PDF base64)
   ├─ fallback su altri modelli se 503/429
   └─ INSERT INTO referti_spiegazioni(referto_id, testo)
   │
   ▼
200 OK { testo }
```

### Cose importanti da dire
- **Perché Service Role e non anon key**: la tabella `referti_spiegazioni` ha RLS che vieta `INSERT` al ruolo `authenticated` (così l'utente non può inventarsi spiegazioni). Solo `service_role` (bypass RLS) può scriverci. Per questo la logica sta **fuori** dal browser.
- **La Service Role Key NON va MAI nel client**: chi ce l'ha ignora tutte le RLS. Sta solo come secret nelle Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`).
- **Prompt strutturato**: chiede a Gemini di rispondere in JSON con `{ sommario, valori[], domande[] }`. C'è un caso "non è un referto" gestito esplicitamente (es. CV, fattura).
- **Fallback multi-modello**: `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash`. Se uno torna 503/429 (sovraccarico/quota), passa al successivo. Solo se tutti falliscono solleva errore.
- **CORS**: `Access-Control-Allow-Origin: *` perché chiamata dal browser. Preflight `OPTIONS` gestito esplicitamente.
- **Secret richiesto**: `GEMINI_API_KEY` impostato via `supabase secrets set`.

---

## 16. Slide 16 — Sicurezza

| Vettore | Difesa nel mio progetto |
|---|---|
| **Chiave API leak (anon)** | È pubblica per design. La sicurezza è nelle policy RLS: senza JWT vedi solo dati public; col JWT puoi agire solo come te stesso. |
| **Chiave Service Role leak** | Mai nel codice, solo nei secret di Supabase Functions. Se trapelasse, bypasserebbe ogni RLS → si rigenera dalla dashboard Supabase. |
| **SQL injection** | Impossibile: Supabase passa per PostgREST con prepared statements. I valori non si concatenano nella query. |
| **XSS** | Angular fa auto-escape via interpolazione `{{ }}`. L'unico bypass è `bypassSecurityTrustResourceUrl`, usato solo sul signed URL del mio bucket → sorgente controllata. |
| **CSRF** | Non applicabile: l'autenticazione usa JWT in header `Authorization`, non cookie con `same-site` magia. |
| **Account enumeration** | Su S1 mostro messaggio generico "Email o password non corretti", non rivelo se l'email esiste. |
| **File malevoli** | Validazione `validaPdf()` su S4: size ≤ 10 MB, MIME, magic bytes, nome sanitizzato. |
| **Path traversal in Storage** | Path costruito server-side concettualmente (`{userId}/...`), policy bucket forza il prefisso = `auth.uid()`. |
| **Privacy referti** | Bucket privato, signed URL temporanei (1h). Analisi AI solo con consenso esplicito (checkbox). |
| **Sovraccarico LLM** | Cache-first: stessa richiesta non re-invoca il modello. Fallback multi-modello su 503/429. |

---

## 17. Slide 17 — Accessibilità e UI

### Stack UI
- **Tailwind CSS 3** per utility responsive (`flex`, `grid`, `gap-*`, `px-4`, `sm:`, `md:`, `lg:`).
- **Design system custom** con prefisso `az-*` (`az-btn`, `az-card`, `az-alert`, `az-topbar`, `az-spinner`) in `app.scss`. Tiene coerenza visiva senza dipendere da un framework UI (Bootstrap/Material/PrimeNG sono vietati dal vincolo d'esame).
- **Variabili CSS** per colori brand (`--az-red`, `--az-muted`, `--az-sub`).

### Pattern UI ricorrente

```html
@if (caricamento()) {
  <div class="az-spinner-wrap" role="status">
    <div class="az-spinner"></div>
    <span class="visually-hidden">Caricamento in corso...</span>
  </div>
}
@if (errore())  { <div class="az-alert az-alert-danger"  role="alert">{{ errore() }}</div> }
@if (successo()){ <div class="az-alert az-alert-success" role="alert">{{ successo() }}</div> }
```

- `@if` e `@for` sono il **control flow nativo** di Angular 17+: sostituiscono `*ngIf` / `*ngFor`, più leggibili e performanti.
- `role="status"` sullo spinner, `role="alert"` sui messaggi: gli screen reader li annunciano automaticamente.
- `.visually-hidden`: testo solo per screen reader, invisibile agli occhi.

### Accessibilità — requisito d'esame

- Ogni `<img>` ha `alt` descrittivo.
- Ogni `<button>` o `<a>` icona-only ha `aria-label`.
- Alert con `role="alert"`, spinner con `role="status"`.
- Navigazione completa da **tastiera** (Tab fra i campi, Enter sui bottoni, Esc per chiudere modali — dove rilevante).
- Contrasti rispettano WCAG AA (asserzione, non test automatici).
- Modali aprono con focus dentro il primo campo.

### Responsiveness
- Breakpoint Tailwind standard. Su mobile la sidebar collassa in una topbar.
- Form a colonna unica su mobile, due colonne da `md:` in su.
- Tabelle e card si adattano a viewport piccoli senza overflow orizzontale.

---

## 18. Slide 18 — Pattern di codice ricorrenti

### `async/await` ovunque
Niente `.then()` annidato, niente `switchMap`, niente Observable se non necessario.
```ts
this.caricamento.set(true);
this.errore.set('');
const { data, error } = await /* chiamata */;
if (error) { this.errore.set('...'); this.caricamento.set(false); return; }
this.risultati.set(data);
this.caricamento.set(false);
```
**Perché**: leggibile riga per riga, early return sull'errore, nessun nested callback. Spiegabile in 20 secondi.

### Signals al posto di `BehaviorSubject`
Stato locale del componente sempre in `signal<T>`. Niente `subscribe` → niente memory leak. Il template li chiama come funzioni, Angular tiene traccia delle dipendenze e ridisegna solo i pezzi affetti.

### Niente `any` selvaggio
Risposte di Supabase cast verso interfacce locali (`TempoAttesa`, `Recensione`, `Referto`, `AttesaUtente`). Solo dove il modello AI risponde libero (`cache.testo`) usiamo `any`, isolato in `parsaRisposta`.

### Metodi piccoli, una cosa sola
Quasi nessun metodo supera 25 righe. Se ne trovi uno più lungo (es. `analizzaReferto`) è una sequenza obbligata cache→invoke→reread → spiegabile come "tre step indipendenti".

### Commenti in italiano sopra ogni metodo
Convenzione richiesta dalla docente. Una riga, dice **cosa fa** (non "come").

```ts
// Carica i tempi di attesa filtrati per termine di ricerca
async cerca(): Promise<void> { ... }
```

### Errori sempre come stringa italiana
I service ritornano `{ data, error: string }`. Il componente fa `if (err) { errore.set(err); return; }`. Niente messaggi tecnici davanti all'utente.

---

## 19. Demo live — script di click ordinato

> Questo è lo **script da eseguire davanti alla commissione** mentre racconti il pitch. Risponde a "fammi vedere".

### Pre-demo (5 secondi prima di iniziare)
- Apri il browser su `http://localhost:4200/` con l'app già avviata.
- Tieni l'IDE aperto in finestra accanto, sui file `attese.service.ts` e `referti.component.ts`.

### Step 1 — Esplora (pubblica, no login) — 60 s
1. *"Apro l'app, mi trovo sulla S2 Esplora."*
2. Cerco `cardiolog` → mostro i risultati con i giorni medi per priorità.
3. Cambio il filtro priorità → noto che è un `computed` lato client, niente nuova query.
4. *"Non sono loggato, quindi non vedo il bottone 'Aggiungi alle mie attese'."*

### Step 2 — Login — 30 s
1. Vado su `/login`.
2. Mostro la registrazione (toggle), poi torno al login. Spiego il messaggio generico (anti enumeration).
3. Login con utente già confermato.
4. *"Vengo reindirizzato a /dashboard. Sotto il cofano la guard ha aspettato `sessioneCaricata` prima di farmi passare."*

### Step 3 — Dashboard — 90 s — **INTERAZIONE DB N.1**
1. Apro il form "Aggiungi attesa". Inserisco "Visita cardiologica", priorità B, data 60 giorni fa.
2. Salvo → INSERT su `attese_utente`. Mostro la card con **stato rosso** e badge "Hai diritto al rimborso".
3. Apro l'IDE su `dashboard.component.ts:salvaAttesa` e mostro le 8 righe.
4. Apro `attese.service.ts` e mostro `inserisci()` + `calcolaStato()` con `SOGLIE`.
5. Clicco "Visita effettuata" → modale con giorni pre-impostati → conferma.
   *"Qui parte `AttesaService.completa()`: INSERT su `recensioni_attesa` + DELETE su `attese_utente`. Due scritture non transazionali, è il limite consapevole dell'MVP."*

### Step 4 — Referti — 90 s — **INTERAZIONE DB N.2**
1. Vado su `/referti`.
2. Trascino un PDF nel drag&drop. *"Il client valida MIME, dimensione e magic bytes prima di partire."*
3. Upload → spinner → card del referto appare.
   *"Due chiamate al backend: upload binario nel bucket Storage, poi INSERT in `referti`. Storage e DB separati ma legati via `storage_path`."*
4. Clicco "Analizza con AI" → consenso esplicito → invocazione Edge Function.
   *"Cache-first: la prima volta chiama Gemini, le successive legge la cache."*
5. Mostro il risultato parsato in `{ sommario, valori, domande }`.
6. (Opzionale) Mostro il PDF in preview, signed URL 1h.

### Step 5 — Pronto Soccorso — 30 s — **API ESTERNA**
1. Vado su `/pronto-soccorso`.
2. *"Niente Supabase qui: `fetch` diretto sull'Open Data della Provincia."*
3. Mostro le card per ospedale ordinate per affollamento.
4. Se ho già storico in `localStorage`: mostro il trend ("+15% in 50 min").

### Step 6 — Diritti — 10 s
1. Vado su `/diritti`. *"L'unica schermata statica. Tabella di 4 righe hard-coded."*

### Step 7 — Logout
1. Logout dalla sidebar.
2. Provo a navigare `/dashboard` manualmente → la guard mi rimanda a `/login`.

### Backup pronto (se qualcosa non funziona)
- **Internet down** → demo offline solo sui dati già caricati, salto S6.
- **Supabase down** → mostro lo schema in `references/data-architecture.md` e il codice nei service.
- **Gemini down** → mostro la cache di un referto già analizzato.

---

## 20. Q&A anticipato

### Generali
| Domanda | Risposta breve |
|---|---|
| Perché Angular se il corso chiede Vue? | Modifica concordata e approvata dal docente. Volevo sperimentare standalone + Signals che è vicino a Vue 3 Composition API. |
| Differenza fra `signal` e `computed`? | `signal` è stato sorgente, `computed` è stato derivato e cached. Si aggiorna automaticamente quando cambia un signal letto dentro. |
| Cosa sono i componenti standalone? | Componenti che dichiarano i propri `imports` senza `NgModule`. Da Angular 17 sono il default; da Angular 21 nemmeno l'app radice serve un module. |
| Perché `loadComponent` invece di `component`? | Lazy loading: il bundle JS della pagina si scarica solo al primo accesso. |

### Autenticazione e sicurezza
| Domanda | Risposta breve |
|---|---|
| Come gestisci l'autenticazione? | Supabase Auth, email + password. Il JWT vive in localStorage. La guard aspetta `getSession()` prima di decidere. |
| Cosa succede se la chiave anon viene rubata? | Niente di grave: senza un JWT valido accede solo a dati pubblici. Le RLS legano ogni utente alle sue righe. |
| Cos'è una RLS policy? | Regola SQL su Postgres che filtra automaticamente righe leggibili/scrivibili in base al ruolo. Tabelle private usano `auth.uid() = user_id`. |
| Differenza fra `USING` e `WITH CHECK`? | `USING` controlla le righe **leggibili** (SELECT/UPDATE/DELETE). `WITH CHECK` controlla le righe **scrivibili** (INSERT/UPDATE). |
| Sono al sicuro da SQL injection? | Sì: tutte le query passano per PostgREST con prepared statements. Mai concatenazione di stringhe. |
| Sono al sicuro da XSS? | Sì: Angular auto-escape via `{{ }}`. L'unico bypass è il signed URL del mio bucket, sorgente controllata. |
| Perché un messaggio di login generico? | Anti account enumeration: non voglio rivelare se l'email esiste. |

### Dati e Storage
| Domanda | Risposta breve |
|---|---|
| Perché Storage **e** tabella `referti` separati? | Lo Storage non è queryabile in SQL. La tabella tiene metadati (`created_at`, `nome_file`, `id`) usabili in JOIN/ORDER/RLS. |
| Cosa fa la tabella `pronto_soccorso_status`? | Nell'MVP attuale niente: S6 chiama l'API direttamente. La tabella resta nello schema per eventuale cache server-side futura. |
| Come gestisci errori di rete? | `try/catch` sul `fetch` esterno, `{data, error}` di Supabase. Mai messaggi tecnici all'utente. |
| Perché `Promise.all` nella dashboard? | Due chiamate indipendenti partono in parallelo, dimezzo la latenza percepita. |

### Logica di dominio (S3)
| Domanda | Risposta breve |
|---|---|
| Come funziona il semaforo verde/giallo/rosso? | `AttesaService.calcolaStato`: confronta giorni passati dalla `data_prenotazione` con la soglia (`SOGLIE`). Rosso = superata = diritto al rimborso; giallo = ≤ 25% rimanente; verde altrimenti. Puro client, niente DB. |
| Il flusso `completa()` è transazionale? | No: INSERT su `recensioni_attesa` poi DELETE su `attese_utente`. Compromesso da MVP. Una transazione vera richiederebbe una RPC Postgres. |
| Perché S2 non scrive più recensioni? | Più realistico chiedere il dato a posteriori (al termine dell'attesa) tramite S3: giorni calcolati, non a memoria, e l'utente ha un motivo per tornare (tracking del rimborso). |

### S6 e API esterna
| Domanda | Risposta breve |
|---|---|
| Perché non c'è retry sull'API PS? | Se fallisce è probabilmente la rete dell'utente: mostro errore e bottone "Riprova" manuale. Retry automatico aggiungerebbe complessità senza beneficio reale. |
| Perché localStorage e non un DB per il trend? | Trend per-dispositivo, peer reti diverse vedono valori diversi: è un valore aggiunto UX, non un dato condiviso. localStorage = zero costo backend, zero auth, sopravvive al refresh. |
| Perché finestra `[25, 75] min` per il confronto? | < 25 min = rumore (1-2 pazienti cambiano in 5 min). > 75 min = informazione obsoleta. Sweet spot ~1 ora. |
| Perché soglia di stabilità 8%? | Evita di urlare "+20%" quando in realtà sono 2 pazienti su 10 (rumore statistico). |

### AI e Edge Function
| Domanda | Risposta breve |
|---|---|
| Cosa fa una Edge Function? | Codice TS/Deno che gira su Supabase. La uso per ciò che non posso fare dal client: Service Role per leggere `storage_path` altrui e per scrivere in `referti_spiegazioni`. |
| Perché la cache delle spiegazioni? | Costo (Gemini chiama a pagamento), latenza (2-5 s) e idempotenza (stesso PDF = stessa risposta). |
| Cosa succede se Gemini risponde male/non-JSON? | `parsaRisposta` prova ad estrarre il JSON, fallback su testo grezzo mostrato com'è. |
| Perché il fallback multi-modello? | `gemini-2.5-flash-lite` ha free tier ma a volte risponde 503/429. Fallback su modelli più capienti tiene viva l'esperienza. |
| GDPR sull'invio dei referti? | Consenso esplicito tramite checkbox prima dell'invio. L'utente sa che il file lascia Supabase e finisce a Google. |

### Operative
| Domanda | Risposta breve |
|---|---|
| L'app funziona offline? | No, è un MVP, tutte le funzionalità richiedono rete. |
| Test automatici? | Vitest configurato ma senza test scritti: l'MVP è dimensionato per la demo orale. |
| Cosa miglioreresti? | Realtime subscriptions Supabase per S6 senza refresh manuale; paginazione lato server per recensioni; esportazione CSV (GDPR); cron Edge per `pronto_soccorso_status` come cache; PWA installabile. |

---

## 21. Glossario rapido

- **Signal** — variabile reattiva di Angular 16+. Leggi `count()`, scrivi `count.set(1)`.
- **Computed** — signal derivato. Si ricalcola quando cambiano le dipendenze lette dentro.
- **Standalone component** — componente Angular senza `NgModule`. Dichiara i propri `imports`.
- **Lazy loading** — il bundle JS di una pagina si scarica al primo accesso. Implementato con `loadComponent`.
- **CanActivateFn** — funzione che decide se una rotta è accessibile. Forma moderna del Guard.
- **RLS (Row Level Security)** — feature Postgres per filtrare righe in base al ruolo del chiamante.
- **JWT** — token firmato che porta l'identità dell'utente. Generato da Supabase Auth al login.
- **Anon key** — chiave pubblica del progetto Supabase. Identifica il progetto, non l'utente.
- **Service Role key** — chiave master, bypassa RLS. Solo lato server (Edge Function secrets).
- **Edge Function** — funzione Deno serverless sull'infrastruttura Supabase, vicino al DB.
- **Signed URL** — URL temporaneo per accedere a un file privato dello Storage.
- **PostgREST** — layer che traduce chiamate HTTP REST in query SQL parametrizzate. Il client Supabase ci parla dietro le quinte.
- **CORS** — meccanismo browser per richieste cross-origin. Configurato `*` nelle Edge Functions.
- **`maybeSingle()`** — variante di `.single()` che ritorna `null` invece di errore se la riga manca.
- **`ilike`** — `LIKE` case-insensitive in Postgres. Usato per la ricerca prestazioni.
- **`{ data, error }`** — convenzione di ritorno di Supabase JS: uno dei due è null.

---

## 22. Checklist finale

Tutto da spuntare prima di entrare in aula.

### Cose da saper recitare a memoria
- [ ] Pitch da 60 secondi (slide 1).
- [ ] Le 6 schermate con il loro path e quale è statica (S5).
- [ ] Le **2 interazioni di modifica DB**: INSERT `attese_utente` su S3 (+ completamento → INSERT `recensioni_attesa` + DELETE `attese_utente`) + upload PDF + INSERT `referti` su S4.
- [ ] L'API esterna usata: `https://dati.retecivica.bz.it/services/PS_Queue/json`.
- [ ] Stack: Angular 21 standalone + Signals · Supabase (Postgres + Auth + Storage + Edge) · Tailwind + `az-*` · Gemini per AI.
- [ ] Modifica concordata: Angular invece di VueJS.

### Cose da saper spiegare a voce
- [ ] Differenza anon key vs service role key, e perché la seconda sta solo nell'Edge Function.
- [ ] Cos'è RLS e come rende sicura la chiave anon esposta nel client.
- [ ] Perché aspetto `sessioneCaricata` nella guard.
- [ ] Perché `Promise.all` nella dashboard.
- [ ] Come funziona il semaforo e da dove arrivano le `SOGLIE`.
- [ ] Perché `AttesaService.completa()` non è transazionale e qual è il rischio.
- [ ] Perché Storage e tabella `referti` sono separati ma collegati via `storage_path`.
- [ ] Validazione PDF su S4 (10 MB, MIME, magic bytes `%PDF`, sanitizzazione nome).
- [ ] Perché il prompt a Gemini richiede output JSON e il fallback `parsaRisposta`.
- [ ] Perché il fallback multi-modello su 503/429.
- [ ] Cosa fa `PsHistoryService`: localStorage, snapshot versionati, finestra `[25, 75] min`, soglia stabilità 8%.
- [ ] Perché `pronto_soccorso_status` è dormiente.

### Cose da saper mostrare nell'IDE
- [ ] `attese.service.ts:inserisci()` e `attese.service.ts:completa()`.
- [ ] `referti.component.ts:caricaReferto()` (upload + INSERT).
- [ ] `referti.component.ts:analizzaReferto()` (cache-first + Edge Function).
- [ ] `supabase/functions/spiega-referto/index.ts` (flusso Service Role).
- [ ] `auth.guard.ts` (3 righe).
- [ ] `app.routes.ts` (rotte protette).
- [ ] `20260512_attese_utente.sql` (policy RLS).

### Sanity check pre-demo
- [ ] Dev server attivo su `:4200`.
- [ ] Internet stabile.
- [ ] Utente di test già confermato.
- [ ] Un PDF di referto pronto sul desktop.
- [ ] IDE aperto sui file chiave.

Buona presentazione.
