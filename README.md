# AttesaZero

Progetto MVP per esame di **Informatica ed elementi di programmazione II** (UniTN).
Portale che mostra i tempi di attesa sanitari della Provincia Autonoma di Bolzano (ASDAA) e lo stato dei Pronto Soccorso in tempo reale, con un hub personale "Le Mie Attese" per tracciare le proprie prenotazioni e un'area di gestione referti PDF con analisi AI.

> Stack: **Angular 21** (standalone + Signals) · **Supabase** (DB, Auth, Storage, Edge Function) · **Bootstrap 5**.
> Il corso richiedeva VueJS: l'uso di Angular è stato concordato e approvato dal docente.

---

## A cosa serve

L'utente può:

1. consultare i tempi di attesa ufficiali ASDAA per prestazione e priorità (B / D / P);
2. vedere lo stato dei Pronto Soccorso aggiornato in tempo reale dall'Open Data della Provincia;
3. registrarsi/loggarsi e tracciare le proprie attese ("Le Mie Attese") con stato semaforo verde/giallo/rosso rispetto alla soglia di legge;
4. al termine di una visita, contribuire al crowdsourcing inserendo i giorni reali attesi;
5. caricare un referto PDF nel proprio spazio personale e chiederne una spiegazione in linguaggio semplice (Edge Function + Gemini);
6. leggere una pagina statica di sintesi sui diritti del paziente in lista d'attesa.

---

## Schermate

| # | Rotta | Auth | Descrizione |
|---|---|---|---|
| S1 | `/login` | pubblica | Login e registrazione (Supabase Auth, email + password) |
| S2 | `/esplora` | pubblica | Ricerca prestazioni e tempi ufficiali ASDAA. Bottone "Aggiungi alle mie attese" per gli utenti loggati (rimanda a S3) |
| S3 | `/dashboard` | privata | Hub personale "Le Mie Attese". **INSERT attesa**, **DELETE attesa**, completamento visita → **INSERT recensione** |
| S4 | `/referti` | privata | **Upload referti PDF** + lista + spiegazione AI con consenso esplicito |
| S5 | `/diritti` | pubblica | Pagina statica: diritti del paziente e priorità sanitarie |
| S6 | `/pronto-soccorso` | pubblica | Stato live dei PS provinciali (fetch diretto API esterna) |

Le rotte private sono protette da `authGuard` ([src/app/guards/auth.guard.ts](src/app/guards/auth.guard.ts)).

---

## Architettura

```
src/app/
├── core/services/
│   ├── supabase.service.ts          # client Supabase singleton
│   ├── auth.service.ts              # login/registra/logout + signal sessione
│   ├── prestazioni.service.ts       # SELECT v_ultime_attese
│   ├── pronto-soccorso.service.ts   # fetch diretto API esterna
│   └── attese.service.ts            # CRUD attese_utente + flusso "completa visita"
├── guards/auth.guard.ts             # protegge /dashboard e /referti
├── pages/                           # una cartella per schermata (S1..S6)
├── app.routes.ts                    # routing standalone con lazy loading
└── app.config.ts                    # provider radice
supabase/
├── migrations/
│   └── 20260512_attese_utente.sql   # schema + RLS della tabella attese_utente
└── functions/
    └── spiega-referto/              # Edge Function Deno: PDF → Gemini → JSON
```

Pattern usati ovunque:

- componenti **standalone** Angular, niente `NgModule`;
- stato locale con **Signals** (`signal`, `computed`), niente RxJS complessa né NgRx;
- chiamate DB con **async/await** sul client `@supabase/supabase-js`;
- UI con **classi Bootstrap 5 standard**, nessun CSS framework alternativo né Tailwind;
- lazy loading delle pagine con `loadComponent`.

---

## Database e API esterna

Schema completo, RLS e query di riferimento in [references/data-architecture.md](references/data-architecture.md).

**Letture pubbliche** (no auth):
- `tempi_attesa_asdaa`, vista `v_ultime_attese` → S2
- `dizionario_priorita` → S5
- API esterna PS Bolzano → S6 (chiamata direttamente dal browser)

**Tabelle private** con RLS `auth.uid() = user_id`:
- `attese_utente` (SELECT + INSERT + DELETE da S3) — **interazione utente n.1**
- `recensioni_attesa` (INSERT da S3 al completamento di un'attesa)
- `referti` (SELECT + INSERT + DELETE da S4) + bucket Storage `referti` — **interazione utente n.2**
- `referti_spiegazioni` (SELECT da client; INSERT solo da Edge Function con Service Role)

**API esterna**: `https://dati.retecivica.bz.it/services/PS_Queue/json` (CORS aperto). Chiamata via `fetch()` direttamente da `ProntoSoccorsoService` ad ogni apertura di S6.

---

## Requisiti d'esame — mappatura

| Requisito | Dove |
|---|---|
| ≥ 5 schermate | 6 schermate (S1–S6) |
| Max 1 schermata statica | Solo S5 (`/diritti`) |
| Login utente | S1, Supabase Auth |
| ≥ 2 interazioni con modifica dati | 1) INSERT `attese_utente` da S3 (più completamento → INSERT `recensioni_attesa`) — 2) upload PDF + INSERT `referti` da S4 |
| DB in lettura e scrittura | Lettura: `v_ultime_attese`, `attese_utente`, `referti`, `referti_spiegazioni`. Scrittura: `attese_utente`, `recensioni_attesa`, `referti`, Storage `referti` |
| API esterna | Open Data PS Bolzano (vedi sopra) |
| Responsiveness | Griglia Bootstrap su tutte le pagine |
| Accessibilità | `aria-label`, `alt`, `role="alert"`, `role="status"`, navigazione tastiera |

---

## Repo pubblico o privato?

Il repository può tranquillamente essere **pubblico**: l'unica credenziale committata è l'**anon key** di Supabase ([src/environments/environment.ts](src/environments/environment.ts)), che per design è destinata al front-end ed è protetta dalle policy RLS sul DB. Nessuna riga può essere letta o scritta senza un JWT utente valido (login).

Cosa **NON** deve mai finire nel repo (e infatti non c'è):

- `SUPABASE_SERVICE_ROLE_KEY` → vive solo come secret della piattaforma Supabase, letta dalla Edge Function via `Deno.env.get()`.
- `GEMINI_API_KEY` → idem, secret di Supabase.
- File `.env` locali, dump del DB, PDF di referti reali.

Se si preferisce comunque tenere il repo privato (es. per non esporre lo schema DB o l'URL del progetto), basta crearlo come *Private* su GitHub: nessuna modifica al codice è necessaria.

---

## Configurazione

### 1. Prerequisiti

- Node.js ≥ 20
- npm ≥ 10
- Account Supabase (piano free sufficiente)
- (Opzionale) Supabase CLI per fare il deploy della Edge Function

### 2. Clonazione e dipendenze

```bash
git clone <repo-url> attesazero
cd attesazero
npm install
```

### 3. Configurazione Supabase

Il file [src/environments/environment.ts](src/environments/environment.ts) contiene URL e chiave **anon (publishable)** del progetto Supabase. Per puntare a un'altra istanza:

```ts
export const environment = {
  production: false,
  supabaseUrl: 'https://<tuo-progetto>.supabase.co',
  supabaseKey: '<anon-publishable-key>',
};
```

La chiave da inserire qui è solo quella pubblica. La Service Role Key non va mai messa nel front-end.

### 4. Schema DB

Schema (tabelle, viste, RLS, bucket Storage) descritto in [references/data-architecture.md](references/data-architecture.md). Migrazione versionata della tabella `attese_utente` in [supabase/migrations/20260512_attese_utente.sql](supabase/migrations/20260512_attese_utente.sql). Le altre tabelle (`tempi_attesa_asdaa`, `recensioni_attesa`, `referti`, `referti_spiegazioni`, viste e bucket) vanno create via SQL editor seguendo gli statement riportati nel documento di architettura.

Bucket Storage richiesto: `referti` (privato, policy: `(storage.foldername(name))[1] = auth.uid()::text`).

### 5. Edge Function

Codice in [supabase/functions/spiega-referto/](supabase/functions/spiega-referto/). Deploy con Supabase CLI:

```bash
supabase functions deploy spiega-referto
```

Secret necessario:

```bash
supabase secrets set GEMINI_API_KEY=<chiave-google-ai>
```

### 6. Avvio in locale

```bash
npm start
```

App su `http://localhost:4200/`. Hot reload attivo.

### 7. Build di produzione

```bash
npm run build
```

Artefatti in `dist/`. Deployabili su qualsiasi static host (Vercel, Netlify, GitHub Pages, Supabase Hosting).

---

## Script npm

| Comando | Cosa fa |
|---|---|
| `npm start` | Dev server Angular su :4200 |
| `npm run build` | Build di produzione in `dist/` |
| `npm run watch` | Build incrementale in modalità dev |
| `npm test` | Test unitari con Vitest |

---

## Note per l'orale

- Ogni metodo nei componenti/servizi è commentato in italiano e fa una cosa sola (≤ 25 righe).
- Niente operatori esotici (no `switchMap`, no decoratori custom, no store globali): solo `async/await`, `if/else` espliciti e Signals.
- Per ogni operazione DB è documentato in commento: tabella coinvolta, presenza/assenza di RLS, gestione errore.
- La Service Role Key è usata **solo** dentro la Edge Function `spiega-referto`, mai esposta al client.
