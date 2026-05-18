-- Optional focus-area hints for AI competency generation (candidate-uploaded JDs)
ALTER TABLE public.jd_candidates
  ADD COLUMN IF NOT EXISTS generation_hints text[] NULL;

COMMENT ON COLUMN public.jd_candidates.generation_hints IS
  'Optional focus-area hints for AI competency generation; persisted per uploaded JD.';
