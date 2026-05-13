import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

// Singleton che crea e conserva UNA SOLA istanza del client Supabase.
// Tutti gli altri servizi iniettano questo servizio invece di creare il client da soli,
// così la connessione al database non viene duplicata.
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    // createClient riceve URL del progetto e chiave anonima pubblica (non segreta).
    // La chiave anon da sola non bypassa le RLS policy: servono le policy Supabase.
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }
}
