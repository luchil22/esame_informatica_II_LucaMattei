# AttesaZero

Progetto MVP per esame di **Informatica ed elementi di programmazione II** — UniTN.
Autore: Luca Mattei.

Portale web che mostra i tempi di attesa sanitari della Provincia Autonoma di Bolzano (ASDAA) e lo stato dei Pronto Soccorso in tempo reale. L'utente registrato può tracciare le proprie prenotazioni in un'area personale "Le Mie Attese", contribuire con i giorni reali attesi a visita conclusa, e caricare referti PDF per riceverne una spiegazione in linguaggio semplice generata da un modello AI.

> Stack: **Angular 21** · **Supabase** (database, login, storage, edge function) · **Tailwind CSS**.
> Il corso prevedeva VueJS: l'uso di Angular è stato concordato e approvato dal docente.

---

## Come funziona l'app

1. **Esplora** — l'utente cerca una prestazione (es. "ecografia") e vede i giorni medi di attesa ufficiali ASDAA, divisi per priorità (Breve, Differibile, Programmabile).
2. **Login / Registrazione** — email + password, gestiti da Supabase Auth.
3. **Le Mie Attese (dashboard)** — l'utente loggato aggiunge una propria attesa indicando prestazione, priorità e data di prenotazione. La dashboard mostra ogni attesa con un semaforo:
   - **verde** = entro i tempi di legge;
   - **giallo** = soglia vicina;
   - **rosso** = soglia superata → diritto al rimborso.
4. **Visita effettuata** — l'utente conferma quanti giorni ha realmente atteso: il dato viene inserito in una tabella di recensioni community e l'attesa rimossa dal suo elenco.
5. **Referti** — l'utente carica un PDF nel proprio spazio privato e, dando il consenso esplicito, lo manda al modello AI (Gemini) tramite una Edge Function. Riceve un riassunto in italiano semplice con valori principali e domande utili da fare al medico.
6. **Pronto Soccorso** — schermata pubblica che mostra in tempo reale quante persone ci sono in ogni PS della provincia, raggruppate per ospedale (dati Open Data Bolzano).
7. **Diritti & Tutela** — pagina informativa sui diritti del paziente in lista d'attesa.

### Schermate

| # | Rotta | Accesso | Cosa fa |
|---|---|---|---|
| S1 | `/login` | pubblica | Login e registrazione |
| S2 | `/esplora` | pubblica | Ricerca prestazioni e tempi ufficiali ASDAA |
| S3 | `/dashboard` | privata | "Le Mie Attese": aggiunta, eliminazione, completamento visita |
| S4 | `/referti` | privata | Upload PDF + analisi AI con consenso |
| S5 | `/diritti` | pubblica | Pagina statica sui diritti del paziente |
| S6 | `/pronto-soccorso` | pubblica | Stato live dei PS provinciali |

### Struttura del codice

```
src/app/
├── core/services/    # client Supabase, login, query DB, API esterna
├── guards/           # protezione rotte private
└── pages/            # una cartella per schermata (S1..S6)
supabase/
├── migrations/       # schema SQL della tabella attese_utente
└── functions/        # Edge Function per l'analisi referti
```

Pattern:

- componenti Angular **standalone** con **Signals** per lo stato locale;
- chiamate al database con `async/await`;
- UI con utility **Tailwind CSS**;
- lazy loading delle pagine.

### Database e API esterna

Schema completo in [references/data-architecture.md](references/data-architecture.md).

- **Letture pubbliche**: tempi ASDAA, dizionario priorità.
- **Tabelle private** (richiedono login): attese personali, recensioni, referti, spiegazioni AI.
- **API esterna**: `https://dati.retecivica.bz.it/services/PS_Queue/json` per lo stato dei PS.

### Requisiti d'esame — mappatura

| Requisito | Dove |
|---|---|
| ≥ 5 schermate | 6 schermate (S1–S6) |
| Max 1 schermata statica | Solo S5 |
| Login utente | Supabase Auth |
| ≥ 2 interazioni con modifica dati | Aggiunta/completamento attesa (S3) · upload referto (S4) |
| DB in lettura e scrittura | Sì, vedi tabella sopra |
| API esterna | Open Data PS Bolzano |
| Responsiveness | Utility responsive Tailwind (breakpoint `sm:`, `md:`, `lg:`) |
| Accessibilità | `aria-label`, `alt`, `role`, navigazione tastiera |

---

## Avvio in locale (per il docente)

L'app è già configurata per puntare al progetto Supabase usato in fase di sviluppo: **non serve creare un proprio database**, basta clonare e lanciare.

### Prerequisiti

- **Node.js ≥ 20** ([nodejs.org](https://nodejs.org))
- **npm** (installato insieme a Node)

### Passi

```bash
# 1. Clona il repository
git clone https://github.com/luchil22/esame_informatica_II_LucaMattei.git
cd esame_informatica_II_LucaMattei

# 2. Installa le dipendenze (la prima volta richiede 1-2 minuti)
npm install

# 3. Avvia il dev server
npm start
```

Aprire il browser su **`http://localhost:4200/`**.

Per provare le funzionalità private (S3 dashboard, S4 referti) registrarsi dalla schermata di login con una email valida e una password di almeno 6 caratteri. Supabase invia una mail di conferma con un link da cliccare: solo dopo la conferma il login è abilitato.

### In caso di problemi

- Se `npm start` segnala porta occupata, chiudere eventuali altri server o cambiare porta con `npm start -- --port 4300`.
- Se le pagine pubbliche caricano ma il login restituisce errore di rete, verificare la connessione a internet (l'app usa Supabase in cloud).

---

## Build di produzione

```bash
npm run build
```

Output statico in `dist/`, pronto per essere servito da qualsiasi hosting.

---

## Configurazione da zero (opzionale)

Se il docente preferisce ricostruire l'ambiente Supabase da zero invece di usare quello già collegato:

1. Creare un nuovo progetto su [supabase.com](https://supabase.com) (piano free sufficiente).
2. Eseguire gli statement SQL descritti in [references/data-architecture.md](references/data-architecture.md) e la migrazione [supabase/migrations/20260512_attese_utente.sql](supabase/migrations/20260512_attese_utente.sql) dall'editor SQL di Supabase.
3. Creare un bucket Storage privato di nome `referti`.
4. Sostituire URL e chiave anon in [src/environments/environment.ts](src/environments/environment.ts):
   ```ts
   export const environment = {
     production: false,
     supabaseUrl: 'https://<tuo-progetto>.supabase.co',
     supabaseKey: '<anon-key>',
   };
   ```
5. (Solo per l'analisi referti AI) Installare la [Supabase CLI](https://supabase.com/docs/guides/cli) e deployare la Edge Function:
   ```bash
   supabase functions deploy spiega-referto
   supabase secrets set GEMINI_API_KEY=<chiave-google-ai>
   ```

---

## Script npm

| Comando | Cosa fa |
|---|---|
| `npm start` | Dev server su :4200 |
| `npm run build` | Build di produzione |
| `npm run watch` | Build incrementale |
| `npm test` | Test con Vitest |

---

## Note finali

- Ogni metodo nei componenti e nei servizi è commentato in italiano e fa una cosa sola.
- Non sono usati operatori RxJS complessi né store globali: solo `async/await`, `if/else` espliciti e Signals.
- Le credenziali sensibili (Service Role Key, chiave Gemini) vivono solo come secret della piattaforma Supabase, mai nel codice.
