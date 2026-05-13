import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Soglie massime in giorni per classe di priorità (D.Lgs. 124/1998 e DPCM 2019).
const SOGLIE: Record<string, number> = { U: 3, B: 10, D: 30, P: 120 };

// Schermata S5 — Diritti & Tutela del paziente con calcolatore rimborso.
// Statica pubblica: non richiede login e non legge/scrive nel database.
// Contiene dati hard-coded (classi priorità, diritti) e un calcolatore lato client.
@Component({
  selector: 'app-diritti',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './diritti.component.html',
})
export class DiritiComponent {
  // Tabella delle classi priorità mostrata nella sezione informativa.
  // Hard-coded: non vengono lette dal database (dati stabili, non cambiano frequentemente).
  priorita = [
    { codice: 'U', nome: 'Urgente',       giorni: 3,   descrizione: 'Prestazione da erogare entro 3 giorni dalla prescrizione' },
    { codice: 'B', nome: 'Breve',         giorni: 10,  descrizione: 'Prestazione da erogare entro 10 giorni dalla prescrizione' },
    { codice: 'D', nome: 'Differibile',   giorni: 30,  descrizione: 'Prestazione da erogare entro 30 giorni dalla prescrizione' },
    { codice: 'P', nome: 'Programmabile', giorni: 120, descrizione: 'Prestazione da erogare entro 120 giorni dalla prescrizione' },
  ];

  // Campi del calcolatore: l'utente inserisce priorità, data prenotazione, data visita.
  prioritaSel      = signal('B');
  dataPrenotazione = signal('');
  dataVisita       = signal('');

  // computed() ricalcola automaticamente il risultato ogni volta che uno dei tre signal cambia.
  // Restituisce null se i campi non sono ancora compilati (il template non mostra nulla).
  risultato = computed(() => {
    if (!this.dataPrenotazione() || !this.dataVisita()) return null;

    const inizio = new Date(this.dataPrenotazione());
    const fine   = new Date(this.dataVisita());
    if (isNaN(inizio.getTime()) || isNaN(fine.getTime())) return null;

    const msGiorno = 1000 * 60 * 60 * 24;
    const giorniAttesa    = Math.floor((fine.getTime() - inizio.getTime()) / msGiorno);
    const soglia          = SOGLIE[this.prioritaSel()];
    const dirittoRimborso = giorniAttesa > soglia; // rimborso solo se SUPERA la soglia

    return { giorniAttesa, soglia, dirittoRimborso };
  });

  // Azzera tutti i campi del calcolatore.
  reset(): void {
    this.dataPrenotazione.set('');
    this.dataVisita.set('');
    this.prioritaSel.set('B');
  }
}
