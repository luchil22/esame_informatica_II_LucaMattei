import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

// Guard funzionale che protegge le rotte private (dashboard, referti).
// Angular chiama questa funzione prima di navigare verso una rotta con canActivate: [authGuard].
// Restituisce true (accesso consentito) o false + redirect a /login (accesso negato).
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  // Aspetta che getSession() abbia risposto (potrebbe essere asincrono al primo avvio).
  // Senza questa attesa, sessione() potrebbe essere null anche se l'utente è loggato.
  await auth.sessioneCaricata;

  if (auth.sessione()) {
    return true;  // sessione valida → accesso consentito
  }

  // Nessuna sessione → reindirizza al login senza mostrare la pagina protetta.
  router.navigate(['/login']);
  return false;
};
