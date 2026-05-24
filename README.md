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

Il dominio è venuto prima di tutto: i dati sanitari toccano chiunque e restano utili nel tempo. Ho confrontato gli open data di Trento e Bolzano. Trento non pubblicava i tempi medi per singola prestazione, Bolzano sì, e in più esponeva gli accessi ai pronto soccorso. I dati ASDAA coprivano entrambi i bisogni, e la scelta è caduta lì.

Per lo stack ho usato Angular, framework su cui avevo già esperienza con app di questo tipo (l'uso al posto di VueJS previsto dal corso è concordato e approvato dal docente). Il backend è Supabase, che riunisce sotto un solo provider database, autenticazione, storage e funzioni serverless, e si integra bene con Angular senza incollare servizi separati. La UI usa Tailwind con utility inline nei template e una classe globale per le variabili di stile, così da non riscrivere colori e misure a ogni componente.

Le funzioni sono nate una a una. I tempi di attesa partono da un CSV ASDAA convertito in SQL: per ogni prestazione restano giorno medio di attesa (dato a febbraio 2026, l'ultimo disponibile), nome e classe di priorità, ed è ciò che la sezione Esplora filtra. Il pronto soccorso legge l'API pubblica della Provincia. I soli numeri di accesso dicono poco (venti persone sono tante o poche?), perciò la funzione trend confronta gli accessi recenti e mostra se l'affluenza sale o scende nell'ultima ora. La sezione referti accetta un PDF, verifica che sia davvero un referto e lo manda a Gemini 2.5 Flash (modello leggero e gratuito), che ne estrae le informazioni principali, i valori a cui prestare attenzione e qualche domanda da rivolgere al medico. Diritti & Tutela, schermata volutamente statica, spiega quando scatta il diritto al rimborso per una prestazione svolta in privato dopo il superamento dei limiti di legge.

Due decisioni reggono il codice. Tutto ciò che parla con l'esterno vive nei servizi in `core/services`; i componenti delle pagine chiedono i dati senza sapere come arrivano. E la sicurezza dei dati privati non sta nel codice dell'app ma nelle policy Row Level Security di Postgres: la chiave pubblica nel frontend è tale per progettazione, e ogni riga riservata resta accessibile solo al suo proprietario.

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

> L'app è già collegata al progetto Supabase di sviluppo tramite la chiave anon pubblica in [src/environments/environment.ts](src/environments/environment.ts). Non serve creare un database né configurare nulla: clonare, `npm install`, `npm start`.

