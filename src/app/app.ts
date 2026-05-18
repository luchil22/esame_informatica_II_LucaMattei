import { Component, effect, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';

// Componente radice dell'applicazione.
// Contiene la shell con sidebar desktop, mobile nav/drawer e il router-outlet
// dove Angular carica il componente della rotta corrente.
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './app.html',
})
export class App {
  // Signal privato per lo stato del menu mobile (aperto/chiuso).
  // Usato dal drawer laterale e dal backdrop semitrasparente.
  private _menuAperto = signal(false);

  // Getter/setter per accedere a _menuAperto dal template senza esporre il signal direttamente.
  get mobileMenuAperto(): boolean { return this._menuAperto(); }
  set mobileMenuAperto(v: boolean) { this._menuAperto.set(v); }

  constructor(public auth: AuthService, private router: Router) {
    // effect() esegue il codice ogni volta che _menuAperto() cambia.
    // Aggiunge/rimuove la classe az-no-scroll sul body per bloccare lo scroll
    // di sfondo mentre il drawer mobile è aperto.
    effect(() => {
      if (typeof document === 'undefined') return; // SSR safety check
      document.body.classList.toggle('az-no-scroll', this._menuAperto());
    });
  }

  // True quando la rotta corrente è /login: nasconde sidebar e mobile nav.
  get isLoginPage(): boolean { return this.router.url.startsWith('/login'); }

  // Restituisce le prime due lettere dell'email in maiuscolo per l'avatar sidebar.
  // Esempio: "marco@email.it" → "MA"
  getInitials(): string {
    const email = this.auth.sessione()?.user?.email ?? '';
    return email.substring(0, 2).toUpperCase();
  }

  // Effettua il logout e reindirizza alla pagina di login.
  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
