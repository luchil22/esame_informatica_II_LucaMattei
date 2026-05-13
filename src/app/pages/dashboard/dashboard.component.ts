import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AttesaService, AttesaCalcolata, AttesaUtente } from '../../core/services/attese.service';

// Tipo locale per i referti da mostrare nel widget "Referti recenti".
// Non include storage_path perché serve solo nome e data per questo riepilogo.
interface Referto {
  id: number;
  nome_file: string;
  created_at: string;
}

// Schermata S3 — Hub personale "Le Mie Attese" (privata, richiede login).
// Interazione con DB:
//   - LETTURA:   attese_utente, referti (SELECT con RLS)
//   - SCRITTURA: attese_utente (INSERT tramite salvaAttesa / DELETE tramite eliminaAttesa)
//   - SCRITTURA: recensioni_attesa (INSERT tramite confermaCompletamento → attesaService.completa)
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  // Stato principale: lista attese calcolate (include giorni, stato semaforo, diritto rimborso).
  attese      = signal<AttesaCalcolata[]>([]);
  // Widget referti recenti (max 3 righe dalla tabella referti).
  referti     = signal<Referto[]>([]);
  caricamento = signal(false);
  errore      = signal('');
  successo    = signal('');

  // Stato del form "aggiungi attesa" — mostraForm controlla la visibilità.
  mostraForm        = signal(false);
  prestazione       = signal('');
  priorita          = signal('B');
  dataPrenotazione  = signal('');
  struttura         = signal('');

  // Stato modale "visita effettuata" — attesaInCompletamento è null quando è chiusa.
  attesaInCompletamento = signal<AttesaCalcolata | null>(null);
  giorniReali           = signal<number | null>(null);

  // Contatore attese in rosso per il banner allerta (si aggiorna ogni volta che attese() cambia).
  conteggioRosso = computed(() => this.attese().filter(a => a.stato === 'rosso').length);

  constructor(
    private auth: AuthService,
    private supabase: SupabaseService,
    private attesaService: AttesaService,
    private route: ActivatedRoute
  ) {}

  // Carica attese e referti in parallelo al primo accesso.
  // Promise.all esegue le due query contemporaneamente (più veloce di sequential await).
  async ngOnInit(): Promise<void> {
    this.preimpostaFormDaQueryParam();
    await Promise.all([this.caricaAttese(), this.caricaRefertiRecenti()]);
  }

  // Se l'utente arriva da S2 (Esplora) tramite il link "Aggiungi alle mie attese",
  // legge i query param ?prestazione=...&priorita=... e precompila il form.
  private preimpostaFormDaQueryParam(): void {
    const params = this.route.snapshot.queryParamMap;
    const p = params.get('prestazione');
    const pr = params.get('priorita');
    if (p) {
      this.prestazione.set(p);
      this.priorita.set(pr || 'B');
      this.dataPrenotazione.set(new Date().toISOString().slice(0, 10)); // data di oggi in formato ISO
      this.mostraForm.set(true);
    }
  }

  // Carica le attese dell'utente e le arricchisce con i calcoli di soglia.
  // LETTURA → tabella: attese_utente (SELECT con RLS: solo righe con user_id = utente corrente).
  async caricaAttese(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set('');

    const { data, error } = await this.attesaService.caricaTutte();
    if (error) {
      this.errore.set(error);
      this.caricamento.set(false);
      return;
    }

    // calcolaStato aggiunge giorniPassati, stato semaforo, dirittoRimborso a ogni attesa.
    const calcolate = data.map(a => this.attesaService.calcolaStato(a));
    this.attese.set(calcolate);
    this.caricamento.set(false);
  }

  // Carica gli ultimi 3 referti dell'utente per il widget nella dashboard.
  // LETTURA → tabella: referti (SELECT con RLS: solo righe con user_id = utente corrente).
  // Query diretta senza passare per un servizio dedicato (solo 3 campi, uso locale).
  async caricaRefertiRecenti(): Promise<void> {
    const { data, error } = await this.supabase.client
      .from('referti')
      .select('id, nome_file, created_at')
      .eq('user_id', this.auth.getUserId())
      .order('created_at', { ascending: false })
      .limit(3);

    if (error) return; // errore non critico: il widget non compare, non blocca la dashboard
    this.referti.set(data as Referto[]);
  }

  // Salva una nuova attesa nel database dopo validazione dei campi obbligatori.
  // SCRITTURA → tabella: attese_utente (INSERT via attesaService.inserisci()).
  // ← INTERAZIONE DB RICHIESTA D'ESAME (scrittura con clic + input).
  async salvaAttesa(): Promise<void> {
    this.errore.set('');
    this.successo.set('');

    if (!this.prestazione() || !this.dataPrenotazione()) {
      this.errore.set('Compila prestazione e data di prenotazione.');
      return;
    }

    const err = await this.attesaService.inserisci({
      prestazione:       this.prestazione(),
      priorita:          this.priorita(),
      data_prenotazione: this.dataPrenotazione(),
      struttura:         this.struttura() || null,
    });

    if (err) {
      this.errore.set(err);
      return;
    }

    this.successo.set('Attesa aggiunta.');
    this.resettaForm();
    await this.caricaAttese(); // ricarica la lista per mostrare la nuova riga
  }

  // Elimina una attesa dopo conferma dell'utente tramite finestra di dialogo nativa.
  // SCRITTURA → tabella: attese_utente (DELETE via attesaService.elimina()).
  async eliminaAttesa(id: number): Promise<void> {
    if (!confirm('Eliminare questa attesa?')) return;

    const err = await this.attesaService.elimina(id);
    if (err) {
      this.errore.set(err);
      return;
    }
    await this.caricaAttese();
  }

  // Apre la modale di completamento, preimpostando i giorni reali con quelli già passati.
  apriCompletamento(a: AttesaCalcolata): void {
    this.attesaInCompletamento.set(a);
    this.giorniReali.set(a.giorniPassati);
  }

  // Chiude la modale senza salvare nulla.
  chiudiCompletamento(): void {
    this.attesaInCompletamento.set(null);
    this.giorniReali.set(null);
  }

  // Conferma il completamento: salva la recensione e rimuove l'attesa.
  // SCRITTURA 1 → tabella: recensioni_attesa (INSERT dei giorni reali — dati community).
  // SCRITTURA 2 → tabella: attese_utente (DELETE della riga completata).
  // ← SECONDO USO della tabella recensioni_attesa per soddisfare requisito d'esame.
  async confermaCompletamento(): Promise<void> {
    const a = this.attesaInCompletamento();
    const gg = this.giorniReali();
    if (!a || gg === null || gg < 0) {
      this.errore.set('Inserisci un numero di giorni valido.');
      return;
    }

    const err = await this.attesaService.completa(a as AttesaUtente, gg);
    if (err) {
      this.errore.set(err);
      return;
    }

    this.successo.set('Visita registrata. Grazie per aver condiviso i tempi reali.');
    this.chiudiCompletamento();
    await this.caricaAttese();
  }

  // Azzera i campi del form e lo nasconde.
  private resettaForm(): void {
    this.prestazione.set('');
    this.priorita.set('B');
    this.dataPrenotazione.set('');
    this.struttura.set('');
    this.mostraForm.set(false);
  }

  // Restituisce la parte dell'email prima della @ per il saluto (es. "marco" da "marco@email.it").
  getEmailShort(): string {
    return this.auth.sessione()?.user.email?.split('@')[0] ?? 'utente';
  }

  // Effettua il logout dell'utente e torna al login.
  async esciDalSito(): Promise<void> {
    await this.auth.logout();
  }

  // Restituisce l'etichetta testuale con i giorni massimi della classe di priorità.
  etichettaPriorita(p: string): string {
    if (p === 'U') return 'Urgente · 3 gg';
    if (p === 'B') return 'Breve · 10 gg';
    if (p === 'D') return 'Differibile · 30 gg';
    if (p === 'P') return 'Programmabile · 120 gg';
    return p;
  }

  // Restituisce lo stile inline del badge colorato in base allo stato semaforo.
  coloreBadge(stato: string): string {
    if (stato === 'rosso')  return 'background:rgba(196,46,46,0.10);color:var(--az-red);';
    if (stato === 'giallo') return 'background:rgba(176,80,0,0.10);color:#B05000;';
    return 'background:rgba(46,160,86,0.10);color:#1F7A3D;';
  }

  // Restituisce il testo del badge di stato.
  testoStato(a: AttesaCalcolata): string {
    if (a.stato === 'rosso')  return 'Soglia superata';
    if (a.stato === 'giallo') return 'Vicino alla soglia';
    return 'Entro la soglia';
  }
}
