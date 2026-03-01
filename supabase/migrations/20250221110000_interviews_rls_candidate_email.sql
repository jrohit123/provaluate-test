-- Allow candidates to see interviews where candidate_id is null but candidate_email matches (e.g. self-created before claim)
CREATE POLICY "Candidates can read interviews by email when unclaimed"
  ON public.interviews FOR SELECT
  USING (
    candidate_id IS NULL
    AND candidate_email = (SELECT email FROM public.candidates WHERE auth_user_id = auth.uid())
  );
