-- Allow candidates to see and claim interviews for "My Interviews"
-- SELECT: only rows where candidate_id matches the logged-in candidate
-- UPDATE: allow setting candidate_id on a row (claim interview when opening link) where candidate_id is null or already theirs
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can read own interviews"
  ON public.interviews FOR SELECT
  USING (
    candidate_id IS NOT NULL
    AND candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  );

CREATE POLICY "Candidates can claim interview (set candidate_id)"
  ON public.interviews FOR UPDATE
  USING (
    candidate_id IS NULL
    OR candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  );
