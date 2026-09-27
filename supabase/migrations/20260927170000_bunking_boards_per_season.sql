-- One bunking board per camp company + season (2026 vs 2027 stay separate).

ALTER TABLE public.bunking_boards
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

ALTER TABLE public.bunking_boards DROP CONSTRAINT IF EXISTS bunking_boards_pkey;

ALTER TABLE public.bunking_boards
  ADD PRIMARY KEY (company_id, season);

COMMENT ON COLUMN public.bunking_boards.season IS 'Camp season this board belongs to (e.g. 2026, 2027).';
