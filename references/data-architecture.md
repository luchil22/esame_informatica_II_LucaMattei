# AttesaZero — Architettura dei Dati
> Provincia Autonoma di Bolzano (ASDAA) · Stack: Angular 21 · Supabase · Bootstrap 5

---

## Indice
1. [Panoramica delle fonti dati](#1-panoramica-delle-fonti-dati)
2. [Tabelle Supabase](#2-tabelle-supabase)
3. [Viste](#3-viste)
4. [RLS — Row Level Security](#4-rls--row-level-security)
5. [Storage e Edge Functions](#5-storage-e-edge-functions)
6. [Fonte dati live: Pronto Soccorso](#6-fonte-dati-live-pronto-soccorso)
7. [Query di riferimento per lo sviluppo](#7-query-di-riferimento-per-lo-sviluppo)
8. [Valori e domini](#8-valori-e-domini)

---

## 1. Panoramica delle fonti dati

| Fonte | Tipo | Tabella/Endpoint | Aggiornamento |
|---|---|---|---|
| ASDAA — Excel ufficiale 2026 | Seed SQL statico | `tempi_attesa_asdaa` | Una tantum (seed) |
| Attese personali utente | Input utenti | `attese_utente` | Real-time |
| Community crowdsourcing | Input utenti (a fine attesa) | `recensioni_attesa` | Real-time |
| API Pronto Soccorso | Browser → API esterna | (nessuna persistenza) | Live ad ogni `fetch` |
| Supabase Auth | Built-in | `auth.users` | Real-time |
| Referti utenti | Storage + DB | `referti` + bucket `referti` | Per upload |
| Spiegazioni AI | Edge Function (Gemini) | `referti_spiegazioni` | Per richiesta, cache permanente |

> ⚠️ La tabella `pronto_soccorso_status` è definita nello schema ma non è in uso nella versione attuale dell'MVP: la schermata S6 chiama direttamente l'API esterna dal browser (vedi §6).

---

## 2. Tabelle Supabase

### 2.1 `tempi_attesa_asdaa` — Dati ufficiali ASDAA
Popolata dal `seed.sql`. Contiene i tempi medi di attesa ufficiali per **Febbraio 2026**.

```sql
CREATE TABLE public.tempi_attesa_asdaa (
  id                     BIGSERIAL   PRIMARY KEY,
  categoria              TEXT        NOT NULL,
  prestazione            TEXT        NOT NULL,
  priorita               CHAR(1)     NOT NULL,
  mese                   TEXT        NOT NULL,
  mese_num               SMALLINT    NOT NULL,
  anno                   SMALLINT    NOT NULL DEFAULT 2026,
  richiesta_prestazioni  INTEGER,
  tempo_medio_attesa     INTEGER,
  mediana_attesa         INTEGER,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

| Colonna | Tipo | Valori possibili | Note |
|---|---|---|---|
| `categoria` | TEXT | `'Prime Visite'`, `'Diagnostica'` | Corrisponde ai 2 fogli Excel |
| `prestazione` | TEXT | 88 valori distinti | Sempre in italiano, maiuscolo |
| `priorita` | CHAR(1) | `'B'`, `'D'`, `'P'` | Vedi §8.1 |
| `mese` | TEXT | `'Febbraio'` | Solo feb 2026 nel seed |
| `mese_num` | SMALLINT | `2` | Solo feb 2026 nel seed |
| `anno` | SMALLINT | `2026` | |
| `richiesta_prestazioni` | INTEGER \| NULL | ≥ 1 | NULL = dato non disponibile |
| `tempo_medio_attesa` | INTEGER \| NULL | giorni | NULL = KV/ND |
| `mediana_attesa` | INTEGER \| NULL | giorni | NULL = KV/ND |

**Indici:** `idx_taa_prestazione`, `idx_taa_categoria`, `idx_taa_priorita`

**Record nel seed:** 252 (Prime Visite: 91 · Diagnostica: 161)

---

### 2.2 `dizionario_priorita` — Lookup priorità
Tabella di riferimento per etichette e soglie delle priorità. Usata dalla schermata **S5 — Diritti & Tutela**.

```sql
CREATE TABLE public.dizionario_priorita (
  codice      CHAR(1)  PRIMARY KEY,
  descrizione TEXT     NOT NULL,
  giorni_max  SMALLINT NOT NULL
);
```

| codice | descrizione | giorni_max |
|---|---|---|
| `U` | Urgente | 3 |
| `B` | Breve | 10 |
| `D` | Differibile | 30 |
| `P` | Programmabile | 120 |

> ⚠️ Il seed ASDAA contiene solo B, D, P. La priorità U è presente nel dizionario per completezza ma non ha dati in `tempi_attesa_asdaa`.

---

### 2.3 `attese_utente` — Hub personale "Le Mie Attese"
Migrazione: [`supabase/migrations/20260512_attese_utente.sql`](../supabase/migrations/20260512_attese_utente.sql).

Ogni utente registra qui le prestazioni che sta aspettando. La schermata S3 calcola lato client lo stato semaforo (verde/giallo/rosso) confrontando `data_prenotazione` con la soglia di legge della priorità.

```sql
CREATE TABLE public.attese_utente (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestazione       TEXT        NOT NULL,
  priorita          CHAR(1)     NOT NULL CHECK (priorita IN ('U','B','D','P')),
  data_prenotazione DATE        NOT NULL,
  struttura         TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attese_utente_user
  ON public.attese_utente(user_id, created_at DESC);

ALTER TABLE public.attese_utente ENABLE ROW LEVEL SECURITY;
```

**Operazioni dal client (S3 Dashboard):**

| Operazione | Quando | Codice |
|---|---|---|
| SELECT | All'apertura della dashboard | `attese.service.ts:caricaTutte()` |
| INSERT | Bottone "Salva attesa" sul form | `attese.service.ts:inserisci()` |
| DELETE | Bottone "Elimina" su una card attesa | `attese.service.ts:elimina()` |
| DELETE | Dopo `completa()` (visita effettuata) | idem |

> ← **Interazione DB richiesta d'esame n.1**: INSERT su `attese_utente` dal form di S3 (clic bottone + 4 input testo/data).

---

### 2.4 `recensioni_attesa` — Crowdsourcing tempi reali
Popolata quando l'utente marca un'attesa come "Visita effettuata" su S3. I dati alimentano la vista aggregata `v_tempi_attesa_community`.

```sql
CREATE TABLE public.recensioni_attesa (
  id                  BIGSERIAL   PRIMARY KEY,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestazione         TEXT        NOT NULL,
  priorita            CHAR(1)     NOT NULL,
  giorni_attesa_reali INTEGER     NOT NULL,
  struttura           TEXT,
  data_visita         DATE,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Operazioni dal client:**

| Operazione | Quando | Codice |
|---|---|---|
| INSERT | Modale "Visita effettuata" su S3 (`confermaCompletamento`) | `attese.service.ts:completa()` |

> Il flusso `completa()` esegue **due scritture in sequenza**: INSERT su `recensioni_attesa` con i giorni reali dichiarati, poi DELETE della riga in `attese_utente`.

---

### 2.5 `pronto_soccorso_status` — Snapshot code PS *(non in uso nell'MVP attuale)*
La tabella esiste nello schema per consentire eventualmente un sync server-side, ma la schermata S6 chiama direttamente l'API esterna ASDAA (vedi §6). Conservata come opzione per future versioni con cache o storico.

```sql
CREATE TABLE public.pronto_soccorso_status (
  id                   BIGSERIAL   PRIMARY KEY,
  hospital_code        TEXT        NOT NULL,
  hospital_description TEXT        NOT NULL,
  triage_code          TEXT        NOT NULL,
  triage_description   TEXT        NOT NULL,
  queue_length         INTEGER     NOT NULL DEFAULT 0,
  last_update_time     TIMESTAMPTZ NOT NULL,
  synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_code, triage_code)
);
```

---

### 2.6 `referti` — Metadati dei PDF caricati
Riga sostitutiva del binario nel bucket Storage `referti`. Il file fisico sta nello Storage; questa tabella ne tiene i metadati queryabili.

```sql
CREATE TABLE public.referti (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_file    TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,   -- es. '{userId}/{timestamp}-{uuid}-{nomeSanitizzato}.pdf'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Operazioni dal client (S4 Referti, S3 Dashboard widget):**

| Operazione | Quando | Codice |
|---|---|---|
| SELECT | Lista referti utente in S4 e widget S3 | `referti.component.ts:caricaReferti()`, `dashboard.component.ts:caricaRefertiRecenti()` |
| INSERT | Dopo upload del PDF nello Storage | `referti.component.ts:caricaReferto()` |
| DELETE | Bottone "Elimina" su una card (step 3 di 3) | `referti.component.ts:eliminaReferto()` |

> ← **Interazione DB richiesta d'esame n.2**: upload PDF nello Storage + INSERT in `referti`. Trigger via file input o drag-and-drop.

---

### 2.7 `referti_spiegazioni` — Cache spiegazioni AI (Gemini)
Cache permanente del risultato dell'Edge Function `spiega-referto`. Una sola colonna `testo` che contiene la risposta grezza del modello (idealmente JSON serializzato, fallback testo libero).

```sql
CREATE TABLE public.referti_spiegazioni (
  id          BIGSERIAL   PRIMARY KEY,
  referto_id  BIGINT      NOT NULL REFERENCES public.referti(id) ON DELETE CASCADE,
  testo       TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Operazioni:**

| Operazione | Da chi | Quando |
|---|---|---|
| SELECT | Client (cache lookup) | Prima di chiamare l'Edge Function |
| INSERT | **Solo Edge Function (service_role)** | Dopo risposta di Gemini |
| DELETE | Client | Step 1 di `eliminaReferto()` |

> Il parsing del campo `testo` in struttura `{ sommario, valori[], domande[] }` è fatto lato client in `referti.component.ts:parsaRisposta()`. Se il JSON non è valido si mostra il testo grezzo come fallback.

---

## 3. Viste

### `v_ultime_attese`
Usata dalla schermata **S2 — Esplora prestazioni**. Espone tutti i record del seed con `tempo_medio_attesa` valorizzato.

```sql
CREATE OR REPLACE VIEW public.v_ultime_attese AS
  SELECT categoria, prestazione, priorita, mese, anno,
         richiesta_prestazioni, tempo_medio_attesa, mediana_attesa
  FROM public.tempi_attesa_asdaa
  WHERE tempo_medio_attesa IS NOT NULL;
```

**Uso tipico in Angular** ([prestazioni.service.ts](../src/app/core/services/prestazioni.service.ts)):
```typescript
const { data } = await supabase
  .from('v_ultime_attese')
  .select('*')
  .ilike('prestazione', `%${searchTerm}%`)
  .order('prestazione');
```

### `v_tempi_attesa_community`
Aggregato delle recensioni crowdsourcing. Pensata per affiancare il dato ufficiale al dato community nella card S2 (estensione futura — al momento il front-end mostra solo il dato ufficiale).

```sql
CREATE OR REPLACE VIEW public.v_tempi_attesa_community AS
  SELECT
    prestazione,
    priorita,
    ROUND(AVG(giorni_attesa_reali))::INTEGER AS tempo_medio_community,
    COUNT(*)                                  AS n_recensioni
  FROM public.recensioni_attesa
  GROUP BY prestazione, priorita;
```

---

## 4. RLS — Row Level Security

| Tabella | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `tempi_attesa_asdaa` | ✅ Pubblico | ❌ | ❌ | ❌ |
| `dizionario_priorita` | ✅ Pubblico | ❌ | ❌ | ❌ |
| `pronto_soccorso_status` | ✅ Pubblico | ❌ (solo service_role) | ❌ | ❌ |
| `attese_utente` | ✅ `auth.uid() = user_id` | ✅ `auth.uid() = user_id` | ✅ proprietario | ✅ proprietario |
| `recensioni_attesa` | ✅ Pubblico (aggregato) | ✅ `auth.uid() = user_id` | ✅ proprietario | ✅ proprietario |
| `referti` | ✅ `auth.uid() = user_id` | ✅ proprietario | ❌ | ✅ proprietario |
| `referti_spiegazioni` | ✅ proprietario via JOIN su `referti` | ❌ (solo service_role) | ❌ | ✅ proprietario (cascade da `referti`) |

Policy `attese_utente` definite nella migrazione [`20260512_attese_utente.sql`](../supabase/migrations/20260512_attese_utente.sql):

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

---

## 5. Storage e Edge Functions

### 5.1 Storage bucket `referti`
- **Tipo:** privato (no URL pubblico).
- **Convenzione path:** `{userId}/{timestamp}-{uuid}-{nomeSanitizzato}.pdf`.
- **Validazione lato client** prima dell'upload ([referti.component.ts:validaPdf](../src/app/pages/referti/referti.component.ts)):
  - dimensione ≤ 10 MB,
  - MIME type `application/pdf`,
  - magic bytes iniziali `%PDF` (0x25 0x50 0x44 0x46),
  - nome file sanitizzato (solo `[a-zA-Z0-9._-]`, max 100 caratteri).
- **Policy bucket:** scrittura/lettura solo nella cartella `auth.uid()::text/` (prefisso path = user id).
- **Visualizzazione PDF:** signed URL temporaneo (1h) via `createSignedUrl(path, 3600)`, embeddato in `<iframe>` con `bypassSecurityTrustResourceUrl`.

### 5.2 Edge Function `spiega-referto`
Codice: [`supabase/functions/spiega-referto/index.ts`](../supabase/functions/spiega-referto/index.ts).

Runtime Deno. Usa **Service Role Key** (secret `SUPABASE_SERVICE_ROLE_KEY`) per:

1. SELECT su `referti` per ottenere `storage_path` del referto richiesto;
2. download del PDF dal bucket privato;
3. invio a Gemini in base64 (`inlineData`) con prompt che richiede output JSON strutturato (`sommario`, `valori[]`, `domande[]`);
4. INSERT del campo `testo` (risposta grezza) in `referti_spiegazioni`.

Fallback su più modelli Gemini in caso di 503/429: `gemini-2.5-flash-lite` → `gemini-2.5-flash` → `gemini-2.0-flash`.

Secret richiesto: `GEMINI_API_KEY`.

> Nella versione attuale **non è deployata alcuna Edge Function `sync-pronto-soccorso`**: la schermata S6 chiama direttamente l'API esterna (vedi §6).

---

## 6. Fonte dati live: Pronto Soccorso

### 6.1 API sorgente

**Endpoint:** `https://dati.retecivica.bz.it/services/PS_Queue/json`
**Metodo:** `GET` — nessuna autenticazione
**CORS:** aperto, chiamabile direttamente dal browser

**Struttura di un record API:**
```json
{
  "HOSPITAL_CODE":        "041001",
  "HOSPITAL_DESCRIPTION": "Bolzano/Bozen",
  "TRIAGE_CODE":          "3",
  "TRIAGE_DESCRIPTION":   "Giallo/Gelb",
  "QUEUE_LENGTH":         2,
  "LAST_UPDATE_TIME":     "2026-04-29T23:29:01"
}
```

| Campo API | Tipo | Descrizione |
|---|---|---|
| `HOSPITAL_CODE` | string | Codice ospedale (es. `"041001"`) |
| `HOSPITAL_DESCRIPTION` | string | Nome bilingue `"Città/Stadt"` |
| `TRIAGE_CODE` | string | `"1"` … `"5"` |
| `TRIAGE_DESCRIPTION` | string | Colore bilingue (es. `"Rosso/Rot"`) |
| `QUEUE_LENGTH` | number | Pazienti in attesa per quel codice |
| `LAST_UPDATE_TIME` | string ISO 8601 | Ultimo aggiornamento del singolo PS |

**Ospedali (7) × triage (5) = 35 record per chiamata.**

| HOSPITAL_CODE | Nome italiano | Nome tedesco |
|---|---|---|
| `041001` | Bolzano | Bozen |
| `041002` | Merano | Meran |
| `041004` | Bressanone | Brixen |
| `041005` | Brunico | Bruneck |
| `041006` | Vipiteno | Sterzing |
| `041007` | San Candido | Innichen |
| `041011` | Silandro | Schlanders |

### 6.2 Lettura dal client

Implementata in [`pronto-soccorso.service.ts`](../src/app/core/services/pronto-soccorso.service.ts) con `fetch()`. Nessun passaggio per Supabase. Logica:

```ts
const response = await fetch('https://dati.retecivica.bz.it/services/PS_Queue/json');
const raw: any[] = await response.json();
const data = raw.map(row => ({
  hospital_code:        row.HOSPITAL_CODE,
  hospital_description: row.HOSPITAL_DESCRIPTION.split('/')[0].trim(), // "Bolzano/Bozen" → "Bolzano"
  triage_code:          row.TRIAGE_CODE,
  triage_description:   row.TRIAGE_DESCRIPTION.split('/')[0].trim(),
  queue_length:         row.QUEUE_LENGTH,
  last_update_time:     row.LAST_UPDATE_TIME,
}));
```

Raggruppamento per ospedale (lato Angular) in [`pronto-soccorso.component.ts`](../src/app/pages/pronto-soccorso/pronto-soccorso.component.ts) tramite `Map<string, OspedaleGruppo>`.

---

## 7. Query di riferimento per lo sviluppo

### Tutte le prestazioni disponibili (autocomplete S2)
```sql
SELECT DISTINCT prestazione, categoria
FROM public.tempi_attesa_asdaa
ORDER BY categoria, prestazione;
```

### Tempi ufficiali per una prestazione specifica
```sql
SELECT priorita, tempo_medio_attesa, mediana_attesa, richiesta_prestazioni
FROM public.v_ultime_attese
WHERE prestazione = 'PRIMA VISITA CARDIOLOGICA. Incluso: ECG (89.52)'
ORDER BY priorita;
```

### Confronto ufficiale vs community (estensione futura S2)
```sql
SELECT
  t.prestazione,
  t.priorita,
  t.tempo_medio_attesa   AS tempo_ufficiale,
  c.tempo_medio_community,
  c.n_recensioni
FROM public.v_ultime_attese t
LEFT JOIN public.v_tempi_attesa_community c
  ON t.prestazione = c.prestazione AND t.priorita = c.priorita
WHERE t.prestazione ILIKE '%cardiolog%';
```

### Attese dell'utente loggato (S3)
```sql
-- Filtro applicato dal client; la RLS impone comunque user_id = auth.uid().
SELECT id, prestazione, priorita, data_prenotazione, struttura, created_at
FROM public.attese_utente
WHERE user_id = auth.uid()
ORDER BY data_prenotazione ASC;
```

### Referti dell'utente con cache AI presente
```sql
SELECT r.id, r.nome_file, r.created_at,
       (s.id IS NOT NULL) AS spiegazione_in_cache
FROM public.referti r
LEFT JOIN public.referti_spiegazioni s ON s.referto_id = r.id
WHERE r.user_id = auth.uid()
ORDER BY r.created_at DESC;
```

---

## 8. Valori e domini

### 8.1 Priorità (CHAR 1)
| Codice | Etichetta | Tempo massimo |
|---|---|---|
| `U` | Urgente | 3 giorni |
| `B` | Breve | 10 giorni |
| `D` | Differibile | 30 giorni |
| `P` | Programmabile | 120 giorni |

Soglie replicate lato client in [`attese.service.ts`](../src/app/core/services/attese.service.ts) come costante `SOGLIE` per il calcolo dello stato semaforo (verde/giallo/rosso) nella dashboard S3.

### 8.2 Categorie prestazioni
| Valore | Descrizione |
|---|---|
| `Prime Visite` | 31 specialità ambulatoriali (es. cardiologica, ortopedica…) |
| `Diagnostica` | 57 esami strumentali (es. colonscopia, TC, RM, ECG…) |

### 8.3 Codici triage Pronto Soccorso

| TRIAGE_CODE | Colore italiano | Significato |
|---|---|---|
| `1` | 🔴 Rosso | Emergenza immediata |
| `2` | 🟠 Arancione | Urgenza |
| `3` | 🟡 Giallo / Verde | Urgenza differibile |
| `4` | 🟢 Verde / Azzurro | Non urgente |
| `5` | ⚪ Bianco / Grigio | Codice minore |

> Le sfumature di colore nel front-end sono in [`pronto-soccorso.component.ts`](../src/app/pages/pronto-soccorso/pronto-soccorso.component.ts) (`TRIAGE_COLORS`).

### 8.4 Strutture Pronto Soccorso

Vedi tabella in §6.1 — 7 ospedali, `hospital_code` da `041001` a `041011` (codici stringa, non numerici).

### 8.5 Storage bucket

| Bucket | Contenuto | Accesso |
|---|---|---|
| `referti` | PDF caricati dagli utenti | Privato — solo proprietario via policy `(storage.foldername(name))[1] = auth.uid()::text` |
