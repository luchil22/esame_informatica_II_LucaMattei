import { Component, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PrestazioniService, TempoAttesa } from '../../core/services/prestazioni.service';
import { AuthService } from '../../core/services/auth.service';

// Schermata S2 — Esplora i tempi di attesa ufficiali ASDAA.
// Pubblica: non richiede login. Legge solo dalla vista v_ultime_attese.
// L'utente loggato vede in più il bottone "Aggiungi alle mie attese" per ogni prestazione.
@Component({
  selector: 'app-esplora',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './esplora.component.html',
})
export class EsploraComponent implements OnInit {
  risultati      = signal<TempoAttesa[]>([]);
  caricamento    = signal(false);
  errore         = signal('');
  termineCerca   = signal('');
  prioritaFiltro = signal('');

  // Filtro priorità applicato localmente (nessuna nuova query al DB).
  // computed() si ricalcola automaticamente quando risultati() o prioritaFiltro() cambiano.
  risultatiFiltrati = computed(() => {
    if (!this.prioritaFiltro()) return this.risultati();
    return this.risultati().filter(r => r.priorita === this.prioritaFiltro());
  });

  constructor(
    private prestazioniService: PrestazioniService,
    private auth: AuthService
  ) {}

  // Carica le prime 50 prestazioni al primo accesso alla pagina.
  async ngOnInit(): Promise<void> {
    await this.caricaTutte();
  }

  // Carica tutte le prestazioni senza filtri di testo.
  // LETTURA → vista: v_ultime_attese (pubblica, no RLS).
  async caricaTutte(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set('');

    const { data, error } = await this.prestazioniService.caricaTutte();

    if (error) {
      this.errore.set(error);
      this.caricamento.set(false);
      return;
    }

    this.risultati.set(data);
    this.caricamento.set(false);
  }

  // Cerca prestazioni per termine inserito dall'utente nel campo di testo.
  // Se il termine è vuoto, ricarica tutte le prestazioni.
  // LETTURA → vista: v_ultime_attese con filtro ILIKE (pubblica, no RLS).
  async cerca(): Promise<void> {
    if (!this.termineCerca()) {
      await this.caricaTutte();
      return;
    }

    this.caricamento.set(true);
    this.errore.set('');

    const { data, error } = await this.prestazioniService.cercaPrestazioni(this.termineCerca());

    if (error) {
      this.errore.set(error);
      this.caricamento.set(false);
      return;
    }

    this.risultati.set(data);
    this.caricamento.set(false);
  }

  // Imposta il filtro priorità per i chip B/D/P/Tutte.
  // Non fa query: filtra i dati già in memoria con computed().
  impostaPriorita(p: string): void {
    this.prioritaFiltro.set(p);
  }

  // Indica se l'utente è loggato per mostrare azioni aggiuntive nel template.
  isLoggato(): boolean {
    return !!this.auth.getUserId();
  }

  // Restituisce l'etichetta testuale con i giorni massimi della classe di priorità.
  etichettaPriorita(priorita: string): string {
    if (priorita === 'B') return 'Breve · 10 gg';
    if (priorita === 'D') return 'Differibile · 30 gg';
    if (priorita === 'P') return 'Programmabile · 120 gg';
    return priorita;
  }
}
