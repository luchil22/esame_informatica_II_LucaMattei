import { Injectable } from '@angular/core';

// Rappresenta lo stato di una coda triage in un ospedale.
// I campi corrispondono alle chiavi dell'API ASDAA dopo la normalizzazione.
export interface ProntoSoccorsoStatus {
  hospital_code: string;        // es. '041001' — stringa, non numero
  hospital_description: string; // nome ospedale (solo parte italiana dopo split '/')[0])
  triage_code: string;          // '1'…'5' — stringa, non numero
  triage_description: string;   // es. 'Emergenza' (solo parte italiana)
  queue_length: number;         // pazienti in attesa in questo triage
  last_update_time: string;     // timestamp ISO dell'ultimo aggiornamento
}

// URL dell'API pubblica ASDAA che espone le code in tempo reale.
// Non richiede autenticazione, i dati sono aggiornati ogni ~5 minuti.
const API_URL = 'https://dati.retecivica.bz.it/services/PS_Queue/json';

// Servizio per leggere le code del pronto soccorso dall'API esterna ASDAA.
// NON usa Supabase: chiama direttamente l'API con fetch() del browser.
// Questa è l'API esterna richiesta dal requisito d'esame.
@Injectable({ providedIn: 'root' })
export class ProntoSoccorsoService {

  // Scarica i dati live dall'API pubblica ASDAA e normalizza i campi bilingue.
  // L'API restituisce campi in MAIUSCOLO (es. HOSPITAL_CODE) → mappati in minuscolo.
  // I nomi sono bilingue (es. "Bolzano/Bozen") → viene tenuta solo la parte italiana.
  async caricaStatus(): Promise<{ data: ProntoSoccorsoStatus[]; error: string }> {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        return { data: [], error: 'Errore nel caricamento dei dati.' };
      }

      const raw: any[] = await response.json();

      // Normalizza ogni riga: rinomina le chiavi e pulisce i nomi bilingue.
      // "Bolzano/Bozen".split('/')[0].trim() → "Bolzano"
      const data: ProntoSoccorsoStatus[] = raw.map(row => ({
        hospital_code:        row.HOSPITAL_CODE,
        hospital_description: row.HOSPITAL_DESCRIPTION.split('/')[0].trim(),
        triage_code:          row.TRIAGE_CODE,
        triage_description:   row.TRIAGE_DESCRIPTION.split('/')[0].trim(),
        queue_length:         row.QUEUE_LENGTH,
        last_update_time:     row.LAST_UPDATE_TIME,
      }));

      return { data, error: '' };
    } catch {
      // Il catch scatta se la rete non è disponibile o l'API è irraggiungibile.
      return { data: [], error: 'Impossibile raggiungere il servizio pronto soccorso.' };
    }
  }
}
