import { Component, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProntoSoccorsoService, ProntoSoccorsoStatus } from '../../core/services/pronto-soccorso.service';

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

  constructor(private psService: ProntoSoccorsoService) {}

  // Carica i dati al primo accesso alla pagina.
  async ngOnInit(): Promise<void> {
    await this.caricaDati();
  }

  // Carica i dati dall'API, li raggruppa per ospedale e li ordina per affollamento crescente.
  // Meno affollato = primo nella lista, così l'utente vede subito dove andare.
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
    gruppi.sort((a, b) => this.totalePazienti(a) - this.totalePazienti(b));
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
  coloreOspedale(ospedale: OspedaleGruppo): string {
    const tot = this.totalePazienti(ospedale);
    if (tot >= 20) return '#EF4444'; // alto
    if (tot >= 10) return '#FB923C'; // medio
    return '#4ADE80';               // basso
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
}
