import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Session } from '@supabase/supabase-js';

// Gestisce login, registrazione, logout e stato sessione dell'utente.
// Il signal `sessione` è reattivo: ogni componente che lo legge si aggiorna
// automaticamente quando l'utente accede o esce.
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Signal con la sessione attiva (null = utente non loggato).
  // Usato da: app.html (sidebar), auth.guard, ogni componente privato.
  sessione = signal<Session | null>(null);

  // Promise che si risolve solo dopo che getSession() ha risposto.
  // L'auth.guard la aspetta prima di decidere se bloccare la navigazione.
  sessioneCaricata: Promise<void>;

  constructor(private supabase: SupabaseService) {
    // Al primo avvio legge la sessione salvata nel browser (localStorage).
    // È asincrono: la sessione potrebbe non essere pronta subito.
    this.sessioneCaricata = this.supabase.client.auth.getSession().then(({ data }) => {
      this.sessione.set(data.session);
    });

    // Ascolta tutti i cambi di stato auth: LOGIN, LOGOUT, TOKEN_REFRESH, ecc.
    // Supabase chiama questo callback anche quando il token viene rinnovato automaticamente.
    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.sessione.set(session);
    });
  }

  // Effettua il login con email e password tramite Supabase Auth.
  // Restituisce stringa vuota se ok, messaggio di errore se fallisce.
  // Non scrive nel database: Supabase gestisce la tabella auth.users internamente.
  async login(email: string, password: string): Promise<string> {
    const { error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    return '';
  }

  // Registra un nuovo utente. Supabase crea il record in auth.users.
  // Restituisce { errore, verificaEmail }:
  //   - verificaEmail=true  → Supabase richiede conferma via email prima del login
  //   - verificaEmail=false → la sessione è già attiva (email confirmation disabilitata)
  async registra(email: string, password: string): Promise<{ errore: string; verificaEmail: boolean }> {
    const { data, error } = await this.supabase.client.auth.signUp({ email, password });

    if (error) {
      return { errore: error.message, verificaEmail: false };
    }

    // Se non c'è sessione dopo la registrazione, serve la conferma email.
    const verificaEmail = !data.session;
    return { errore: '', verificaEmail };
  }

  // Effettua il logout: invalida il JWT e svuota la sessione locale.
  async logout(): Promise<void> {
    await this.supabase.client.auth.signOut();
  }

  // Restituisce l'UUID dell'utente loggato (es. "a1b2-...").
  // Stringa vuota se nessuno è loggato. Usato come user_id nelle INSERT.
  getUserId(): string {
    return this.sessione()?.user.id ?? '';
  }
}
