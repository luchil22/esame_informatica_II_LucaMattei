import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

// Rappresenta una riga della vista v_ultime_attese.
// La vista aggrega i dati di tempi_attesa_asdaa mostrando solo il record più recente
// per ogni combinazione (prestazione, priorità).
export interface TempoAttesa {
  prestazione: string;
  priorita: string;       // 'B' | 'D' | 'P'
  categoria: string;      // 'Prime Visite' | 'Diagnostica'
  mese: string;
  anno: number;
  tempo_medio_attesa: number;  // giorni medi di attesa ufficiali ASDAA
  mediana_attesa: number;
  richiesta_prestazioni: number;
}

// Servizio per leggere i tempi di attesa ufficiali ASDAA dal database.
// Legge solo dalla vista v_ultime_attese (SELECT pubblico, nessuna RLS necessaria).
@Injectable({ providedIn: 'root' })
export class PrestazioniService {
  constructor(private supabase: SupabaseService) {}

  // Cerca prestazioni per termine di ricerca usando ILIKE (ricerca case-insensitive).
  // LETTURA → vista: v_ultime_attese (dati pubblici, nessun login richiesto).
  // Restituisce { data, error } dove error è stringa vuota se tutto ok.
  async cercaPrestazioni(termine: string): Promise<{ data: TempoAttesa[]; error: string }> {
    const { data, error } = await this.supabase.client
      .from('v_ultime_attese')
      .select('*')
      .ilike('prestazione', `%${termine}%`)  // % = wildcard: cerca il termine ovunque nel nome
      .order('prestazione');

    if (error) return { data: [], error: 'Errore nel caricamento dei dati.' };
    return { data: data as TempoAttesa[], error: '' };
  }

  // Carica le prime 50 prestazioni senza filtri per il caricamento iniziale della pagina.
  // LETTURA → vista: v_ultime_attese (dati pubblici, nessun login richiesto).
  async caricaTutte(): Promise<{ data: TempoAttesa[]; error: string }> {
    const { data, error } = await this.supabase.client
      .from('v_ultime_attese')
      .select('*')
      .order('prestazione')
      .limit(50);  // limite per non caricare centinaia di righe in una volta

    if (error) return { data: [], error: 'Errore nel caricamento dei dati.' };
    return { data: data as TempoAttesa[], error: '' };
  }
}
