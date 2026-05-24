# AttesaZero

Progetto MVP per esame di **Informatica ed elementi di programmazione II** (UniTN).
Autore: Luca Mattei.

Portale web che mostra i tempi di attesa sanitari della Provincia Autonoma di Bolzano (ASDAA) e lo stato dei Pronto Soccorso in tempo reale. L'utente registrato può tracciare le proprie prenotazioni in un'area personale «Le Mie Attese», contribuire con i giorni reali attesi a visita conclusa, e caricare referti PDF per riceverne una spiegazione in linguaggio semplice generata da un modello AI.

> 🌐 **Demo live**: [https://lucam223.sg-host.com](https://lucam223.sg-host.com)
> Hosting su SiteGround, backend Supabase. Per provare le funzionalità private (S3 e S4) registrarsi con email valida e confermare il link ricevuto via mail.

> Stack: **Angular 21** · **Supabase** (database, login, storage, edge function) · **Tailwind CSS**.
> Il corso prevedeva VueJS: l'uso di Angular è stato concordato e approvato dal docente.

---

## Genesi e scelte di progetto

Il punto di partenza è stato il dominio: i dati sanitari. Sono dati che restano utili nel tempo e che toccano chiunque, e per questo si prestavano a un'applicazione con un'utilità concreta per il cittadino. La prima fase è stata quindi una ricerca sugli open data delle due province autonome, Trento e Bolzano. Trento non pubblicava i tempi di attesa medi con il dettaglio per prestazione; Bolzano sì, e in più esponeva gli accessi ai pronto soccorso. La scelta è ricaduta sui dati ASDAA proprio perché coprivano entrambi i bisogni: tempi medi delle prestazioni e affluenza in tempo reale.

Definito il dominio, è seguita la scelta dello stack. La scelta è caduta su Angular per via dell'esperienza già maturata su applicazioni di questo tipo, comode da gestire con questo framework; l'uso al posto di VueJS previsto dal corso è una modifica concordata e approvata dal docente. Il backend poggia su Supabase, che raccoglie sotto un solo provider database, autenticazione, storage dei file e funzioni serverless: una flessibilità che si integra bene con Angular ed evita di incollare insieme servizi separati. La veste grafica usa Tailwind CSS con le utility inline nei template, affiancate da una classe globale per le variabili di stile, così da non riscrivere gli stessi colori e le stesse misure a ogni componente.

Le funzionalità sono nate una alla volta, ciascuna da un bisogno preciso. I tempi di attesa partono da un file CSV ASDAA convertito in una query SQL che ha popolato la tabella delle prestazioni: per ognuna restano il giorno medio di attesa (dato aggiornato a febbraio 2026, l'ultimo disponibile), il nome e la classe di priorità, ed è questo che permette di filtrarle nella sezione Esplora. Il pronto soccorso usa invece l'API pubblica della Provincia di Bolzano. I soli numeri di accesso, però, dicono poco: difficile capire se venti persone in un ospedale grande siano tante o poche rispetto a uno piccolo. Da qui la funzione trend, che confronta gli accessi recenti e mostra se l'affluenza sta salendo o scendendo nell'ultima ora, restituendo un'informazione leggibile anche a chi non conosce le dimensioni della struttura.

L'integrazione dell'intelligenza artificiale risponde a un problema quotidiano: i referti di ecografie ed esami sono spesso scritti in un linguaggio strettamente medico, di difficile lettura per il paziente. La sezione dedicata accetta il caricamento di un PDF, verifica che si tratti davvero di un referto e, in caso contrario, lo segnala senza procedere. Il file viene analizzato da Gemini 2.5 Flash, un modello leggero, gratuito e adatto a questo compito, che produce un riassunto delle informazioni principali, i valori a cui prestare attenzione e alcune domande utili da rivolgere al medico. L'ultima pagina è Diritti & Tutela: un form, su una schermata volutamente statica, che aiuta a capire quando si ha diritto al rimborso per una prestazione svolta in struttura privata, un diritto che scatta al superamento dei limiti di legge e che spesso resta sconosciuto.

Sul piano dell'organizzazione del codice, due decisioni reggono l'impianto. La prima: tutto ciò che parla con l'esterno vive nei servizi in `core/services`, mentre i componenti delle pagine si limitano a chiedere i dati senza sapere come vengono recuperati. La seconda: la sicurezza dei dati privati non è affidata al codice dell'applicazione ma alle policy Row Level Security di Postgres, scritte direttamente nel database. La chiave pubblica esposta nel frontend è tale per progettazione, e a proteggere le tabelle è il fatto che ogni riga riservata risulta accessibile solo al suo proprietario.

---

## Come funziona l'app

1. **Esplora**: l'utente cerca una prestazione (es. «ecografia») e vede i giorni medi di attesa ufficiali ASDAA, divisi per priorità (Breve, Differibile, Programmabile).
2. **Login / Registrazione**: email + password, gestiti da Supabase Auth.
3. **Le Mie Attese (dashboard)**: l'utente loggato aggiunge una propria attesa indicando prestazione, priorità e data di prenotazione. La dashboard mostra ogni attesa con un semaforo:
   - **verde**: entro i tempi di legge;
   - **giallo**: soglia vicina;
   - **rosso**: soglia superata, diritto al rimborso.
4. **Visita effettuata**: l'utente conferma quanti giorni ha realmente atteso. Il dato viene inserito in una tabella di recensioni community e l'attesa rimossa dal suo elenco.
5. **Referti**: l'utente carica un PDF nel proprio spazio privato e, dando il consenso esplicito, lo manda al modello AI (Gemini) tramite una Edge Function. Riceve un riassunto in italiano semplice con valori principali e domande utili da fare al medico.
6. **Pronto Soccorso**: schermata pubblica che mostra in tempo reale quante persone ci sono in ogni PS della provincia, raggruppate per ospedale (dati Open Data Bolzano).
7. **Diritti & Tutela**: pagina informativa sui diritti del paziente in lista d'attesa.

### Schermate

| # | Rotta | Accesso | Cosa fa |
|---|---|---|---|
| S1 | `/login` | pubblica | Login e registrazione |
| S2 | `/esplora` | pubblica | Ricerca prestazioni e tempi ufficiali ASDAA |
| S3 | `/dashboard` | privata | «Le Mie Attese»: aggiunta, eliminazione, completamento visita |
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

### Requisiti d'esame: mappatura

| Requisito | Dove |
|---|---|
| ≥ 5 schermate | 6 schermate (S1–S6) |
| Max 1 schermata statica | Solo S5 |
| Login utente | Supabase Auth |
| ≥ 2 interazioni con modifica dati | Aggiunta/completamento attesa (S3) · upload referto (S4) |
| DB in lettura e scrittura | Sì, vedi tabella sopra |
| API esterna | Open Data PS Bolzano |
| Responsiveness | Utility responsive Tailwind (breakpoint `sm:`, `md:`, `lg:`) |
| Accessibilità | `aria-label`, `alt`, `role`, navigazione da tastiera |

---

## Provare l'app

### Opzione 1: demo online (consigliata)

Aprire **[https://lucam223.sg-host.com](https://lucam223.sg-host.com)** dal browser. Nessuna installazione richiesta.

### Opzione 2: avvio in locale

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


