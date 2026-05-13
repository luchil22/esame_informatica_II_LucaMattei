import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

// Rappresenta una riga della tabella attese_utente nel database.
// I campi con ? sono opzionali: struttura e note possono essere null.
export interface AttesaUtente {
  id?: number;
  user_id?: string;
  prestazione: string;
  priorita: string;          // 'U' | 'B' | 'D' | 'P'
  data_prenotazione: string; // formato ISO: 'yyyy-mm-dd'
  struttura?: string | null;
  note?: string | null;
  created_at?: string;
}

// AttesaCalcolata estende AttesaUtente aggiungendo campi calcolati lato client.
// Non sono nel database: vengono calcolati da calcolaStato() ogni volta che si caricano le attese.
export interface AttesaCalcolata extends AttesaUtente {
  giorniMaxLegge: number;    // soglia legge per la priorità (es. 10 per 'B')
  giorniPassati: number;     // giorni trascorsi dalla data di prenotazione ad oggi
  giorniRimanenti: number;   // giorniMaxLegge - giorniPassati (negativo = soglia superata)
  stato: 'verde' | 'giallo' | 'rosso';
  dirittoRimborso: boolean;  // true se giorniRimanenti < 0
}

// Soglie massime di attesa in giorni per classe di priorità (D.Lgs. 124/1998).
const SOGLIE: Record<string, number> = { U: 3, B: 10, D: 30, P: 120 };

// Servizio CRUD per la tabella attese_utente.
// TABELLA: attese_utente — protetta da RLS: ogni utente vede/modifica solo le proprie righe.
// RLS policy: auth.uid() = user_id su SELECT, INSERT, UPDATE, DELETE.
@Injectable({ providedIn: 'root' })
export class AttesaService {
  constructor(
    private supabase: SupabaseService,
    private auth: AuthService
  ) {}

  // Carica tutte le attese attive dell'utente loggato, ordinate per data crescente.
  // LETTURA → tabella: attese_utente (RLS: restituisce solo righe con user_id = utente corrente).
  async caricaTutte(): Promise<{ data: AttesaUtente[]; error: string }> {
    const userId = this.auth.getUserId();
    if (!userId) return { data: [], error: 'Utente non loggato.' };

    const { data, error } = await this.supabase.client
      .from('attese_utente')
      .select('*')
      .eq('user_id', userId)
      .order('data_prenotazione', { ascending: true });

    if (error) return { data: [], error: 'Errore nel caricamento delle attese.' };
    return { data: data as AttesaUtente[], error: '' };
  }

  // Inserisce una nuova attesa nel database.
  // SCRITTURA → tabella: attese_utente (INSERT — RLS verifica che user_id = utente corrente).
  // Restituisce stringa vuota se ok, messaggio di errore se fallisce.
  async inserisci(attesa: AttesaUtente): Promise<string> {
    const userId = this.auth.getUserId();
    if (!userId) return 'Utente non loggato.';

    const { error } = await this.supabase.client
      .from('attese_utente')
      .insert({
        user_id:           userId,
        prestazione:       attesa.prestazione,
        priorita:          attesa.priorita,
        data_prenotazione: attesa.data_prenotazione,
        struttura:         attesa.struttura ?? null,
        note:              attesa.note ?? null,
      });

    if (error) return 'Errore nel salvataggio dell\'attesa.';
    return '';
  }

  // Elimina una attesa esistente per id.
  // SCRITTURA → tabella: attese_utente (DELETE — RLS impedisce di eliminare righe altrui).
  async elimina(id: number): Promise<string> {
    const { error } = await this.supabase.client
      .from('attese_utente')
      .delete()
      .eq('id', id);

    if (error) return 'Errore nell\'eliminazione.';
    return '';
  }

  // Marca una attesa come completata: salva la recensione e poi rimuove l'attesa.
  // SCRITTURA 1 → tabella: recensioni_attesa (INSERT — alimenta i dati community in v_tempi_attesa_community).
  // SCRITTURA 2 → tabella: attese_utente (DELETE tramite elimina()).
  // I giorni reali inseriti dall'utente diventano dati aggregati visibili a tutti in S2.
  async completa(attesa: AttesaUtente, giorniReali: number): Promise<string> {
    const userId = this.auth.getUserId();
    if (!userId) return 'Utente non loggato.';

    const { error: errRec } = await this.supabase.client
      .from('recensioni_attesa')
      .insert({
        user_id:             userId,
        prestazione:         attesa.prestazione,
        priorita:            attesa.priorita,
        giorni_attesa_reali: giorniReali,
        struttura:           attesa.struttura ?? null,
      });

    if (errRec) return 'Errore nel salvataggio della recensione.';

    // Elimina l'attesa solo se la recensione è stata salvata con successo.
    if (attesa.id !== undefined) {
      await this.elimina(attesa.id);
    }
    return '';
  }

  // Arricchisce una AttesaUtente con i calcoli di soglia, giorni e stato semaforo.
  // NON fa query al database: usa solo i campi dell'attesa e la data di oggi.
  // Viene chiamato dopo ogni caricaTutte() per trasformare i dati grezzi in AttesaCalcolata.
  calcolaStato(attesa: AttesaUtente): AttesaCalcolata {
    const giorniMaxLegge  = SOGLIE[attesa.priorita] ?? 30;
    const giorniPassati   = this.giorniDa(attesa.data_prenotazione);
    const giorniRimanenti = giorniMaxLegge - giorniPassati;

    // Semaforo: rosso = soglia superata, giallo = meno del 25% del tempo rimanente
    let stato: 'verde' | 'giallo' | 'rosso' = 'verde';
    if (giorniRimanenti < 0) stato = 'rosso';
    else if (giorniRimanenti <= giorniMaxLegge * 0.25) stato = 'giallo';

    return {
      ...attesa,
      giorniMaxLegge,
      giorniPassati,
      giorniRimanenti,
      stato,
      dirittoRimborso: giorniRimanenti < 0,
    };
  }

  // Calcola quanti giorni sono trascorsi da una data ISO (yyyy-mm-dd) fino ad oggi.
  // Usa millisecondi per evitare problemi con ore legali e fusi orari.
  private giorniDa(dataIso: string): number {
    const inizio = new Date(dataIso);
    const oggi   = new Date();
    const msGiorno = 1000 * 60 * 60 * 24;
    return Math.floor((oggi.getTime() - inizio.getTime()) / msGiorno);
  }
}
