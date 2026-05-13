# CLAUDE.md — AttesaZero
> Progetto universitario MVP · Provincia Autonoma di Bolzano (ASDAA)
> Corso: Informatica ed elementi di programmazione II — UniTN
> Stack: Angular 17+ · Supabase · Tailwind CSS

---

## ⚠️ Requisiti d'esame — checklist obbligatoria

Il progetto vale 1/3 del voto (max 10 punti). L'orale è individuale e può vertere su qualsiasi riga di codice. Ogni requisito qui sotto **deve essere soddisfatto e dimostrabile**.

| Requisito | Come è soddisfatto in AttesaZero | Stato |
|---|---|---|
| Almeno 5 schermate | S1 Login · S2 Esplora · S3 Dashboard · S4 Referti · S5 Diritti · S6 Pronto Soccorso | ✅ 6 schermate |
| Max 1 schermata statica | Solo S5 (Diritti & Tutela) è hard-coded | ✅ |
| Login utente | S1 con Supabase Auth (email + password) | ✅ |
| Min 2 interazioni con modifica dati (clic + input) | 1) Inserimento recensione attesa (S2) · 2) Upload referto PDF (S4) | ✅ |
| Uso di un DB (lettura **e** scrittura) | Lettura: `tempi_attesa_asdaa`, `pronto_soccorso_status` · Scrittura: `recensioni_attesa`, `referti` | ✅ |
| Uso di una API esterna | `https://dati.retecivica.bz.it/services/PS_Queue/json` (Pronto Soccorso live) | ✅ |
| Responsiveness | Utility responsive Tailwind (breakpoint `sm:`, `md:`, `lg:`) su tutte le schermate | ✅ |
| Accessibilità | `aria-label`, `alt` su immagini, `role` su alert, navigazione da tastiera | ✅ da garantire |
| Framework del corso | Il corso richiede VueJS — **il professore ha concesso Angular come modifica concordata** | ✅ approvato |

> **Nota orale**: per ogni interazione con il DB devi saper spiegare: quale tabella viene letta/scritta, perché è protetta (o no) da RLS, e cosa succede in caso di errore.

---

## Regole assolute di sviluppo

### Tecnologia
- **Angular 17+** con componenti standalone e Signals *(modifica concordata col prof al posto di VueJS)*
- **Supabase JS** (`@supabase/supabase-js`) per DB, Auth e Storage
- **Tailwind CSS** per tutta la UI — utility class direttamente nei template
- **VIETATI altri CSS framework** (Bootstrap, Material, PrimeNG, ecc.)
- **CSS custom elaborato** da evitare — al massimo pochi stili globali per colori brand

### Semplicità del codice (regola d'esame)
Il codice deve essere **spiegabile a voce in 30 secondi per metodo**. L'esaminatore può fermarti su qualsiasi riga.

- Preferire sempre la soluzione più semplice, anche se meno elegante
- Usare `if/else` espliciti — no operatori ternari annidati
- Ogni metodo fa **una cosa sola**, max 20-25 righe
- No pattern avanzati: niente `switchMap`, niente `NgRx`, niente decoratori custom
- Se devi scegliere tra "corto ma oscuro" e "lungo ma chiaro" → **lungo ma chiaro**

### Commenti in italiano
Ogni metodo nei componenti e nei servizi deve avere un commento in italiano:
```typescript
// Carica i tempi di attesa filtrati per prestazione e priorità
async caricaPrestazioni(): Promise<void> { ... }

// Salva la recensione dell'utente nel database
async salvaRecensione(): Promise<void> { ... }
```

### Accessibilità (requisito d'esame)
- Tutti gli `<img>` hanno `alt` descrittivo
- Tutti i bottoni e input hanno `aria-label` o `<label>` associata
- Gli alert usano `role="alert"`
- Lo spinner usa `role="status"` con `<span class="visually-hidden">`
- La navigazione funziona anche solo con la tastiera (Tab + Enter)

---

## Le 2 interazioni con modifica dati — implementazione

Queste due funzionalità **devono esserci e funzionare** per soddisfare il requisito d'esame.

### Interazione 1 — Inserimento recensione (S2 Esplora)
L'utente loggato inserisce il tempo di attesa reale che ha vissuto.

```typescript
// Template: form con input testo, input numerico e bottone "Salva"
// Dati scritti nella tabella: recensioni_attesa

async salvaRecensione(): Promise<void> {
  const { error } = await this.supabase.client
    .from('recensioni_attesa')
    .insert({
      user_id:             this.userId,
      prestazione:         this.prestazioneSelezionata,
      priorita:            this.prioritaSelezionata,
      giorni_attesa_reali: this.giorniAttesa,
    });

  if (error) {
    this.errore.set('Errore nel salvataggio.');
    return;
  }
  this.successo.set('Grazie! La tua esperienza è stata salvata.');
}
```

### Interazione 2 — Upload referto PDF (S4 Referti)
L'utente carica un PDF dal proprio dispositivo.

```typescript
// Template: <input type="file" accept=".pdf"> + bottone "Carica"
// Dati scritti in: Storage bucket "referti" + tabella "referti"

async caricaReferto(evento: Event): Promise<void> {
  const input = evento.target as HTMLInputElement;
  const file  = input.files?.[0];
  if (!file) return;

  // 1. Carica il file su Supabase Storage
  const percorso = `${this.userId}/${file.name}`;
  const { error: erroreStorage } = await this.supabase.client
    .storage.from('referti').upload(percorso, file);

  if (erroreStorage) {
    this.errore.set('Errore nel caricamento del file.');
    return;
  }

  // 2. Salva i metadati nel database
  await this.supabase.client
    .from('referti')
    .insert({ user_id: this.userId, nome_file: file.name, storage_path: percorso });
}
```

---

## Architettura dell'app

### Struttura cartelle
```
src/app/
├── core/
│   └── services/
│       ├── supabase.service.ts        # client Supabase singleton
│       ├── auth.service.ts            # login, registrazione, logout
│       ├── prestazioni.service.ts     # query su tempi_attesa_asdaa
│       └── pronto-soccorso.service.ts # fetch pronto_soccorso_status
├── guards/
│   └── auth.guard.ts                  # protegge S3 e S4
├── pages/
│   ├── login/                         # S1 — pubblica
│   ├── esplora/                       # S2 — pubblica
│   ├── dashboard/                     # S3 — privata (AuthGuard)
│   ├── referti/                       # S4 — privata (AuthGuard)
│   ├── diritti/                       # S5 — statica pubblica
│   └── pronto-soccorso/               # S6 — pubblica
└── app.routes.ts
```

### Routing
```typescript
export const routes: Routes = [
  { path: '',                redirectTo: 'esplora', pathMatch: 'full' },
  { path: 'login',           component: LoginComponent },
  { path: 'esplora',         component: EsploraComponent },
  { path: 'pronto-soccorso', component: ProntoSoccorsoComponent },
  { path: 'diritti',         component: DiritiComponent },
  { path: 'dashboard',       component: DashboardComponent,  canActivate: [authGuard] },
  { path: 'referti',         component: RefertiComponent,    canActivate: [authGuard] },
];
```

---

## Database Supabase — riferimento rapido

> Documentazione completa in `data_architecture.md`

### Tabelle pubbliche (nessun login)
| Tabella / Vista | Usata in | Operazione |
|---|---|---|
| `tempi_attesa_asdaa` | S2 | SELECT |
| `v_ultime_attese` | S2 | SELECT (vista pronta) |
| `dizionario_priorita` | S5 | SELECT |
| `pronto_soccorso_status` | S3, S6 | SELECT |
| `v_tempi_attesa_community` | S2 | SELECT (vista aggregata) |

### Tabelle private (richiedono login — `auth.uid() = user_id`)
| Tabella | Usata in | Operazione |
|---|---|---|
| `recensioni_attesa` | S2 | SELECT + **INSERT** ← interazione 1 |
| `referti` | S4 | SELECT + **INSERT** ← interazione 2 |
| `referti_spiegazioni` | S4 | SELECT (scrittura solo da Edge Function) |

### Campi da ricordare
- `tempi_attesa_asdaa.categoria` → `'Prime Visite'` o `'Diagnostica'`
- `tempi_attesa_asdaa.priorita` → `'B'` | `'D'` | `'P'`
- `pronto_soccorso_status.hospital_code` → `'041001'`…`'041011'` (stringa)
- `pronto_soccorso_status.triage_code` → `'1'`…`'5'` (stringa, non numero)

### Query tipo
```typescript
// Ricerca prestazioni per S2
const { data, error } = await this.supabase.client
  .from('v_ultime_attese')
  .select('*')
  .ilike('prestazione', `%${termine}%`)
  .order('prestazione');

// Dati Pronto Soccorso per S6
const { data, error } = await this.supabase.client
  .from('pronto_soccorso_status')
  .select('hospital_code, hospital_description, triage_code, triage_description, queue_length, last_update_time')
  .order('hospital_code')
  .order('triage_code');
```

---

## Pattern standard — usare sempre questi

### Stato del componente con Signals
```typescript
caricamento = signal(false);
errore      = signal('');
successo    = signal('');
risultati   = signal<any[]>([]);
```

### Chiamata DB — async/await con gestione errore
```typescript
async caricaDati(): Promise<void> {
  this.caricamento.set(true);
  this.errore.set('');

  const { data, error } = await this.supabase.client
    .from('v_ultime_attese')
    .select('*');

  if (error) {
    this.errore.set('Errore nel caricamento dei dati.');
    this.caricamento.set(false);
    return;
  }

  this.risultati.set(data);
  this.caricamento.set(false);
}
```

### Template Tailwind standard (con accessibilità)
```html
<!-- Spinner di caricamento -->
@if (caricamento()) {
  <div class="text-center py-4">
    <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" role="status">
      <span class="sr-only">Caricamento in corso...</span>
    </div>
  </div>
}

<!-- Messaggio di errore -->
@if (errore()) {
  <div class="rounded-md bg-red-50 border border-red-200 text-red-800 px-4 py-3" role="alert">{{ errore() }}</div>
}

<!-- Messaggio di successo -->
@if (successo()) {
  <div class="rounded-md bg-green-50 border border-green-200 text-green-800 px-4 py-3" role="alert">{{ successo() }}</div>
}

<!-- Lista risultati -->
@for (item of risultati(); track item.id) {
  <div class="rounded-lg border border-gray-200 bg-white shadow-sm mb-3 p-4">
    <h5 class="text-lg font-semibold">{{ item.prestazione }}</h5>
  </div>
}
```

---

## Cose da NON fare

| ❌ Evita | ✅ Usa invece | Motivo |
|---|---|---|
| `switchMap`, `mergeMap` | `async/await` | Impossibile da spiegare a voce |
| `BehaviorSubject` complessi | Signal | Più semplice e moderno |
| `NgRx` / store | Stato locale nel componente | Overkill per un MVP universitario |
| CSS custom elaborato | Utility Tailwind nei template | Coerenza e leggibilità |
| Pipe custom | Metodo helper nel componente | Più leggibile all'orale |
| `any` ovunque in TypeScript | Tipi semplici o interfacce brevi | Dimostra comprensione del codice |

---

## Priorità sanitarie — riferimento rapido

| Codice | Nome | Giorni max |
|---|---|---|
| U | Urgente | 3 |
| B | Breve | 10 |
| D | Differibile | 30 |
| P | Programmabile | 120 |

> Nel seed ASDAA ci sono solo B, D, P. La U è nel `dizionario_priorita` per la schermata S5 (Diritti & Tutela).

---

## Edge Functions (Supabase Deno)

### `sync-pronto-soccorso`
- Chiama `https://dati.retecivica.bz.it/services/PS_Queue/json`
- Upsert su `pronto_soccorso_status` con chiave `(hospital_code, triage_code)`
- Pulisce i nomi bilingue: `"Bolzano/Bozen"` → `"Bolzano"` con `.split('/')[0].trim()`

### `spiega-referto`
- Riceve `referto_id`, scarica il PDF dal bucket `referti`, invia a Gemini
- Usa Service Role Key (bypassa RLS)
- Salva in `referti_spiegazioni` (cache — non rigenera se esiste già)
- L'utente **deve dare consenso esplicito** nell'UI prima che venga chiamata