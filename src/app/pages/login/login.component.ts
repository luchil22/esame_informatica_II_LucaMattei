import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';

// Schermata S1 — Login e registrazione utente.
// Mostra un unico form che cambia modalità tra login e registrazione.
// Nessuna interazione diretta col database: tutto passa per AuthService e Supabase Auth.
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  // Signals per i campi del form — si aggiornano direttamente dal template con (input).
  email             = signal('');
  password          = signal('');
  confermaPassword  = signal('');
  errore            = signal('');
  successo          = signal('');
  caricamento       = signal(false);

  // Non è un signal perché non ha bisogno di reattività cross-componente.
  mostraRegistrazione = false;

  constructor(private auth: AuthService, private router: Router) {}

  // Alterna tra modalità login e registrazione, resettando i messaggi di stato.
  cambiaModalita(): void {
    this.mostraRegistrazione = !this.mostraRegistrazione;
    this.errore.set('');
    this.successo.set('');
    this.confermaPassword.set('');
  }

  // Effettua il login chiamando AuthService.login().
  // In caso di successo, Angular aggiorna automaticamente il signal sessione
  // tramite onAuthStateChange, poi naviga alla dashboard.
  async accedi(): Promise<void> {
    this.caricamento.set(true);
    this.errore.set('');
    this.successo.set('');

    const errMsg = await this.auth.login(this.email(), this.password());

    if (errMsg) {
      // Messaggio generico per non rivelare se l'email esiste o meno (sicurezza).
      this.errore.set('Email o password non corretti.');
      this.caricamento.set(false);
      return;
    }

    this.caricamento.set(false);
    this.router.navigate(['/dashboard']);
  }

  // Valida i campi di registrazione PRIMA di chiamare il backend.
  // Restituisce il primo errore trovato, o stringa vuota se tutto è valido.
  // La validazione lato client non sostituisce quella del server, ma evita
  // chiamate inutili a Supabase per errori ovvi (password troppo corta, ecc.).
  validaRegistrazione(): string {
    const email = this.email().trim();
    const pwd   = this.password();
    const conf  = this.confermaPassword();

    if (!email || !email.includes('@')) {
      return 'Inserisci un indirizzo email valido.';
    }
    if (pwd.length < 8) {
      return 'La password deve avere almeno 8 caratteri.';
    }
    if (pwd !== conf) {
      return 'Le due password non coincidono.';
    }
    return '';
  }

  // Registra un nuovo account chiamando AuthService.registra().
  // Supabase crea la riga in auth.users (tabella interna, non accessibile via SQL diretto).
  // Due scenari post-registrazione:
  //   1. verificaEmail=true  → Supabase ha inviato email di conferma (mostra avviso)
  //   2. verificaEmail=false → sessione già attiva, naviga alla dashboard
  async registrati(): Promise<void> {
    this.errore.set('');
    this.successo.set('');

    const erroreValidazione = this.validaRegistrazione();
    if (erroreValidazione) {
      this.errore.set(erroreValidazione);
      return;
    }

    this.caricamento.set(true);
    const risultato = await this.auth.registra(this.email(), this.password());
    this.caricamento.set(false);

    if (risultato.errore) {
      this.errore.set('Registrazione fallita: ' + risultato.errore);
      return;
    }

    if (risultato.verificaEmail) {
      this.successo.set('Account creato. Controlla la tua email e clicca sul link di conferma per completare la registrazione.');
      this.password.set('');
      this.confermaPassword.set('');
      return;
    }

    // Conferma email disabilitata su Supabase → sessione già attiva.
    this.router.navigate(['/dashboard']);
  }
}
