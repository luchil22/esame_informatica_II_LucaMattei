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

  // --- Paginazione ---
  // Mostriamo 20 prestazioni per pagina invece di tutte le ~250 in una volta.
  perPagina      = 20;
  paginaCorrente = signal(1);

  // Numero totale di pagine: arrotonda per eccesso (es. 41 risultati → 3 pagine).
  numeroPagine = computed(() => {
    const totale = this.risultatiFiltrati().length;
    return Math.ceil(totale / this.perPagina);
  });

  // Solo le righe della pagina corrente: taglia l'array filtrato con slice().
  risultatiPaginati = computed(() => {
    const inizio = (this.paginaCorrente() - 1) * this.perPagina;
    const fine   = inizio + this.perPagina;
    return this.risultatiFiltrati().slice(inizio, fine);
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
    this.paginaCorrente.set(1);

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
    this.paginaCorrente.set(1);

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
  // Torna a pagina 1 perché il numero di risultati cambia.
  impostaPriorita(p: string): void {
    this.prioritaFiltro.set(p);
    this.paginaCorrente.set(1);
  }

  // Vai alla pagina precedente, senza scendere sotto la 1.
  paginaPrecedente(): void {
    if (this.paginaCorrente() > 1) {
      this.paginaCorrente.set(this.paginaCorrente() - 1);
    }
  }

  // Vai alla pagina successiva, senza superare il numero totale di pagine.
  paginaSuccessiva(): void {
    if (this.paginaCorrente() < this.numeroPagine()) {
      this.paginaCorrente.set(this.paginaCorrente() + 1);
    }
  }

  // Vai direttamente a una pagina specifica (usato dai numeri di pagina).
  vaiAPagina(n: number): void {
    this.paginaCorrente.set(n);
  }

  // Restituisce l'elenco dei numeri di pagina [1, 2, 3, ...] per i bottoni.
  elencoPagine(): number[] {
    const pagine: number[] = [];
    for (let i = 1; i <= this.numeroPagine(); i++) {
      pagine.push(i);
    }
    return pagine;
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
