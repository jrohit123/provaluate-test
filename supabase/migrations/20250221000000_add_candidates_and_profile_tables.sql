-- Candidate identity (separate from users/recruiters)
-- users table remains for recruiters only
CREATE TABLE IF NOT EXISTS public.candidates (
  candidate_id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidates_pkey PRIMARY KEY (candidate_id),
  CONSTRAINT candidates_auth_user_id_key UNIQUE (auth_user_id),
  CONSTRAINT candidates_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_candidates_auth_user_id ON public.candidates(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_candidates_email ON public.candidates(email);

-- JDs uploaded by candidate (candidate-only; not job_descriptions/jd_for_interview)
CREATE TABLE IF NOT EXISTS public.jd_candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  title text,
  jd_file text,
  extracted_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT jd_candidates_pkey PRIMARY KEY (id),
  CONSTRAINT jd_candidates_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(candidate_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jd_candidates_candidate_id ON public.jd_candidates(candidate_id);

-- Single table for all candidate profile details (flow-cv style sections stored as JSONB)
-- profile_data can hold: summary, headline, education[], experience[], skills[], languages[],
-- certificates[], interests[], projects[], courses[], awards[], organisations[], publications[],
-- references[], declaration, custom_sections[]
CREATE TABLE IF NOT EXISTS public.candidate_profile_details (
  candidate_id uuid NOT NULL,
  profile_data jsonb NOT NULL DEFAULT '{}',
  resume_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT candidate_profile_details_pkey PRIMARY KEY (candidate_id),
  CONSTRAINT candidate_profile_details_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.candidates(candidate_id) ON DELETE CASCADE
);

-- Link interviews to candidate account for "My Interviews"
ALTER TABLE public.interviews
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(candidate_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);

-- RLS: enable and policy for candidates (candidate can only read/update own row)
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidates can read own row"
  ON public.candidates FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Candidates can update own row"
  ON public.candidates FOR UPDATE
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Allow insert own candidate row"
  ON public.candidates FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- RLS for jd_candidates
ALTER TABLE public.jd_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidate can manage own jd_candidates"
  ON public.jd_candidates FOR ALL
  USING (
    candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  );

-- RLS for candidate_profile_details
ALTER TABLE public.candidate_profile_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Candidate can manage own profile details"
  ON public.candidate_profile_details FOR ALL
  USING (
    candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    candidate_id IN (SELECT candidate_id FROM public.candidates WHERE auth_user_id = auth.uid())
  );
