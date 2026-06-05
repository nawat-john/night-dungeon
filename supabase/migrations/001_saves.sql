-- Save table keyed by IP address (or fallback UUID).
-- Run this once in your Supabase SQL editor or via `supabase db push`.

CREATE TABLE IF NOT EXISTS public.saves (
  ip_address  TEXT        NOT NULL,
  data        JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT  saves_pkey  PRIMARY KEY (ip_address)
);

-- Row Level Security — enabled but fully open policy.
-- Every client can read and write using only their own IP address key;
-- there is no auth token to forge, so this is intentional for this game.
ALTER TABLE public.saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saves_open"
  ON public.saves
  FOR ALL
  USING (true)
  WITH CHECK (true);
