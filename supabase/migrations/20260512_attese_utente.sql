-- Migrazione: tabella attese_utente
-- Hub personale "Le Mie Attese" (schermata S3 Dashboard)
-- Ogni utente registra le prestazioni che sta aspettando per monitorare
-- la soglia di legge e capire se ha diritto al rimborso.

CREATE TABLE IF NOT EXISTS public.attese_utente (
  id                BIGSERIAL   PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prestazione       TEXT        NOT NULL,
  priorita          CHAR(1)     NOT NULL CHECK (priorita IN ('U','B','D','P')),
  data_prenotazione DATE        NOT NULL,
  struttura         TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attese_utente_user
  ON public.attese_utente(user_id, created_at DESC);

-- RLS: ogni utente vede e modifica solo le proprie attese
ALTER TABLE public.attese_utente ENABLE ROW LEVEL SECURITY;

CREATE POLICY attese_utente_select_own
  ON public.attese_utente FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY attese_utente_insert_own
  ON public.attese_utente FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY attese_utente_update_own
  ON public.attese_utente FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY attese_utente_delete_own
  ON public.attese_utente FOR DELETE
  USING (auth.uid() = user_id);
