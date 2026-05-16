import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProntoSoccorsoService, ProntoSoccorsoStatus } from '../../core/services/pronto-soccorso.service';
import { PsHistoryService, PsTrend } from '../../core/services/ps-history.service';

// Struttura dati raggruppata usata nel template: un ospedale con tutti i suoi triage.
// ProntoSoccorsoService restituisce righe piatte (una per triage); questo componente
// le raggruppa per hospital_code per visualizzare una card per ospedale.
export interface OspedaleGruppo {
  codice: string;
  nome:   string;
  triages: ProntoSoccorsoStatus[];
}

// Colori standard per codice triage (sistema italiano: 1=rosso, 5=bianco/grigio).
const TRIAGE_COLORS: Record<string, string> = {
  '1': '#EF4444', // Rosso — emergenza
  '2': '#FB923C', // Arancione — urgenza
  '3': '#4ADE80', // Verde — urgenza differibile
  '4': '#38BDF8', // Azzurro — urgenza minore
  '5': '#94A3B8', // Bianco/grigio — non urgente
};

// Schermata S6 — Stato code pronto soccorso in tempo reale.
// Pubblica: non richiede login.
// NON usa il database Supabase: legge direttamente dall'API esterna ASDAA.
// ← API ESTERNA richiesta dal requisito d'esame.
// Salva inoltre uno snapshot dei totali in localStorage ad ogni refresh per
// calcolare il trend ("+20% nell'ultima ora") — valore aggiunto rispetto al sito ASDAA.
@Component({
  selector: 'app-pronto-soccorso',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './pronto-soccorso.component.html',
})
export class ProntoSoccorsoComponent implements OnInit {
  ospedali    = signal<OspedaleGruppo[]>([]);
  caricamento = signal(false);
  errore      = signal('');

  // Trend per ospedale calcolato a ogni caricaDati() — null se non c'è ancora
  // abbastanza storico (es. primo accesso). Indicizzato per hospital_code.
  trends = signal<Record<string, PsTrend | null>>({});

  constructor(
    private psService:      ProntoSoccorsoService,
    private historyService: PsHistoryService,
  ) {}

  // Carica i dati al primo accesso alla pagina.
  async ngOnInit(): Promise<void> {
    await this.caricaDati();
  }

  // Carica i dati dall'API, li raggruppa per ospedale, salva uno snapshot
  // nello storico locale e calcola il trend per ogni ospedale.
  // Ordina le card per affollamento decrescente (più pieno = primo).
  async caricaDati(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set('');

    const { data, error } = await this.psService.caricaStatus();

    if (error) {
      this.errore.set(error);
      this.caricamento.set(false);
      return;
    }

    const gruppi = this.raggruppaPerOspedale(data);

    // Prepara la mappa { codice -> totale } per lo snapshot e per i trend.
    const totali: Record<string, number> = {};
    for (const g of gruppi) {
      totali[g.codice] = this.totalePazienti(g);
    }

    // Calcola i trend PRIMA di salvare il nuovo snapshot, altrimenti il confronto
    // userebbe come passato un dato appena scritto (= sempre stabile).
    const trends: Record<string, PsTrend | null> = {};
    for (const g of gruppi) {
      trends[g.codice] = this.historyService.calcolaTrend(g.codice, totali[g.codice]);
    }
    this.trends.set(trends);

    // Salva lo snapshot corrente in localStorage per i prossimi confronti.
    this.historyService.salvaSnapshot(totali);

    // Ordina per affollamento decrescente: più pieni in cima.
    gruppi.sort((a, b) => this.totalePazienti(b) - this.totalePazienti(a));
    this.ospedali.set(gruppi);
    this.caricamento.set(false);
  }

  // Raggruppa le righe piatte dell'API in una Map indicizzata per hospital_code,
  // poi restituisce l'array dei valori.
  raggruppaPerOspedale(rows: ProntoSoccorsoStatus[]): OspedaleGruppo[] {
    const mappa = new Map<string, OspedaleGruppo>();

    for (const row of rows) {
      if (!mappa.has(row.hospital_code)) {
        mappa.set(row.hospital_code, {
          codice: row.hospital_code,
          nome:   row.hospital_description,
          triages: [],
        });
      }
      mappa.get(row.hospital_code)!.triages.push(row);
    }

    return Array.from(mappa.values());
  }

  // Somma i pazienti di tutti i triage per ottenere il totale dell'ospedale.
  totalePazienti(ospedale: OspedaleGruppo): number {
    return ospedale.triages.reduce((acc, t) => acc + t.queue_length, 0);
  }

  // Restituisce il colore hex per il codice triage; grigio come fallback se non riconosciuto.
  coloreTriage(codice: string): string {
    return TRIAGE_COLORS[codice] ?? '#94A3B8';
  }

  // Calcola la percentuale di pazienti di un triage sul totale ospedale per la barra colorata.
  // Math.max(..., 1) evita divisione per zero quando il totale è 0.
  percentualeTriage(queueLength: number, ospedale: OspedaleGruppo): number {
    const totale = Math.max(this.totalePazienti(ospedale), 1);
    return (queueLength / totale) * 100;
  }

  // Restituisce il colore della barra superiore della card in base all'affollamento totale.
  // Soglie scelte sul dato osservato dall'API (la maggior parte degli ospedali ha 0-15 in attesa).
  coloreOspedale(ospedale: OspedaleGruppo): string {
    const tot = this.totalePazienti(ospedale);
    if (tot >= 20) return '#EF4444'; // alto
    if (tot >= 10) return '#FB923C'; // medio
    return '#4ADE80';                // basso
  }

  // Restituisce il livello testuale dell'affollamento per il badge.
  livelloOspedale(ospedale: OspedaleGruppo): string {
    const tot = this.totalePazienti(ospedale);
    if (tot >= 20) return 'ALTO';
    if (tot >= 10) return 'MEDIO';
    return 'BASSO';
  }

  // Restituisce lo stile inline del badge livello con colori appropriati.
  badgeStyleOspedale(ospedale: OspedaleGruppo): string {
    const tot = this.totalePazienti(ospedale);
    if (tot >= 20) return 'padding:3px 10px;border-radius:999px;background:rgba(239,68,68,0.10);color:#EF4444;font-size:9px;font-weight:800;letter-spacing:0.8px;flex-shrink:0;margin-left:8px;border:1px solid rgba(239,68,68,0.27);';
    if (tot >= 10) return 'padding:3px 10px;border-radius:999px;background:rgba(251,146,60,0.10);color:#FB923C;font-size:9px;font-weight:800;letter-spacing:0.8px;flex-shrink:0;margin-left:8px;border:1px solid rgba(251,146,60,0.27);';
    return 'padding:3px 10px;border-radius:999px;background:rgba(74,222,128,0.09);color:#4ADE80;font-size:9px;font-weight:800;letter-spacing:0.8px;flex-shrink:0;margin-left:8px;border:1px solid rgba(74,222,128,0.27);';
  }

  // Restituisce il trend memorizzato per un dato ospedale (o null se non disponibile).
  trendOspedale(codice: string): PsTrend | null {
    return this.trends()[codice] ?? null;
  }

  // Restituisce il colore della freccia trend: rosso se in aumento (peggiora),
  // verde se in diminuzione (migliora), grigio se stabile.
  coloreTrend(trend: PsTrend): string {
    if (trend.dir === 'up')   return '#EF4444';
    if (trend.dir === 'down') return '#4ADE80';
    return '#94A3B8';
  }

  // Restituisce il simbolo freccia per il trend.
  simboloTrend(trend: PsTrend): string {
    if (trend.dir === 'up')   return '↑';
    if (trend.dir === 'down') return '↓';
    return '→';
  }

  // Restituisce un'etichetta testuale leggibile per il trend (es. "+20% in 45 min").
  // Il segno '+' è esplicito per i valori positivi per chiarezza visiva.
  etichettaTrend(trend: PsTrend): string {
    const segno  = trend.deltaPct > 0 ? '+' : '';
    const valore = Math.round(trend.deltaPct);
    return `${segno}${valore}% in ${trend.minutiFa} min`;
  }
}
