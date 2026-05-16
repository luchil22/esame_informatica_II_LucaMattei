import { Injectable } from '@angular/core';

// Uno snapshot dello stato totale dei pronto soccorso a un certo istante.
// I totali sono indicizzati per hospital_code per permettere il confronto
// tra istanti diversi e calcolare il trend per ogni ospedale.
export interface PsSnapshot {
  ts:        number;                 // timestamp epoch ms
  totali:    Record<string, number>; // { '041001': 12, '041002': 7, ... }
}

// Risultato del calcolo del trend per un singolo ospedale.
// 'dir' è il senso del movimento, 'deltaPct' è la variazione percentuale,
// 'minutiFa' è l'età del campione storico usato come base di confronto.
export interface PsTrend {
  dir:       'up' | 'down' | 'stable';
  deltaAbs:  number;  // pazienti in più (o in meno) rispetto al passato
  deltaPct:  number;  // variazione percentuale (può essere negativa)
  minutiFa:  number;  // età dello snapshot di confronto in minuti
}

// Chiave usata in localStorage. Versionata: se cambia lo schema, basta cambiare 'v1'.
const STORAGE_KEY = 'attesazero_ps_history_v1';

// Numero massimo di snapshot tenuti in memoria locale (circa 4 ore con refresh ogni 5 min).
const MAX_SNAPSHOTS = 50;

// Finestra temporale per cercare lo snapshot di confronto (in minuti).
// MIN_AGE evita di confrontare con dati troppo recenti (rumore),
// MAX_AGE evita di confrontare con dati troppo vecchi (informazione obsoleta).
const MIN_AGE_MIN = 25;
const MAX_AGE_MIN = 75;

// Variazione % sotto la quale considero il trend "stabile" — evita di urlare
// "+20%" quando in realtà sono passati 2 pazienti su 10 (rumore statistico).
const STABLE_THRESHOLD_PCT = 8;

// Servizio per lo storico locale dei pronto soccorso.
// Memorizza in localStorage gli snapshot dei totali per ospedale ad ogni refresh,
// così la card può mostrare il trend ("+20% nell'ultima ora") rispetto al sito ufficiale ASDAA
// che mostra solo il dato puntuale. Lo storico è per-dispositivo (non condiviso tra utenti).
@Injectable({ providedIn: 'root' })
export class PsHistoryService {

  // Legge dallo localStorage tutti gli snapshot salvati. Se il parsing fallisce
  // (chiave mancante o JSON corrotto) ritorna un array vuoto.
  leggiStorico(): PsSnapshot[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  }

  // Aggiunge un nuovo snapshot in coda e taglia la coda a MAX_SNAPSHOTS elementi.
  // Salva subito in localStorage così il dato sopravvive al refresh della pagina.
  salvaSnapshot(totali: Record<string, number>): void {
    const storico = this.leggiStorico();
    storico.push({ ts: Date.now(), totali });

    // Mantieni solo gli ultimi MAX_SNAPSHOTS elementi.
    const tagliato = storico.slice(-MAX_SNAPSHOTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tagliato));
  }

  // Calcola il trend di un ospedale confrontando il totale attuale con quello
  // di uno snapshot tra 25 e 75 minuti fa. Ritorna null se non ci sono dati
  // storici sufficienti (es. primo accesso, finestra non coperta).
  calcolaTrend(codice: string, totaleAttuale: number): PsTrend | null {
    const storico = this.leggiStorico();
    const ora     = Date.now();

    // Cerca il candidato più vecchio dentro la finestra [25, 75] minuti.
    // Più vecchio = trend su orizzonte più lungo, meno influenzato da rumore.
    const minTs = ora - MAX_AGE_MIN * 60 * 1000;
    const maxTs = ora - MIN_AGE_MIN * 60 * 1000;

    let candidato: PsSnapshot | null = null;
    for (const snap of storico) {
      if (snap.ts < minTs || snap.ts > maxTs) continue;
      if (snap.totali[codice] === undefined) continue;
      if (candidato === null || snap.ts < candidato.ts) {
        candidato = snap;
      }
    }

    if (candidato === null) return null;

    const totalePassato = candidato.totali[codice];
    const deltaAbs      = totaleAttuale - totalePassato;
    const minutiFa      = Math.round((ora - candidato.ts) / 60000);

    // Per il % usiamo Math.max(totalePassato, 1) per evitare divisione per zero
    // quando l'ospedale era vuoto: in quel caso il delta % perde significato,
    // mostriamo comunque il delta assoluto.
    const deltaPct = (deltaAbs / Math.max(totalePassato, 1)) * 100;

    let dir: 'up' | 'down' | 'stable';
    if (Math.abs(deltaPct) < STABLE_THRESHOLD_PCT) {
      dir = 'stable';
    } else if (deltaPct > 0) {
      dir = 'up';
    } else {
      dir = 'down';
    }

    return { dir, deltaAbs, deltaPct, minutiFa };
  }
}
