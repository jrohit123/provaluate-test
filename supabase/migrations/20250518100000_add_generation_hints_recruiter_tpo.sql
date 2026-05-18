-- Optional focus-area hints for AI competency generation (TPO + recruiter JD tables)
ALTER TABLE public.campus_interview_templates
  ADD COLUMN IF NOT EXISTS generation_hints text[] NULL;

ALTER TABLE public.jd_for_interview
  ADD COLUMN IF NOT EXISTS generation_hints text[] NULL;

ALTER TABLE public.job_descriptions
  ADD COLUMN IF NOT EXISTS generation_hints text[] NULL;

COMMENT ON COLUMN public.campus_interview_templates.generation_hints IS
  'Optional focus-area hints for AI competency generation; persisted per campus template.';

COMMENT ON COLUMN public.jd_for_interview.generation_hints IS
  'Optional focus-area hints for AI competency generation; persisted per interview JD.';

COMMENT ON COLUMN public.job_descriptions.generation_hints IS
  'Optional focus-area hints for AI competency generation; persisted per CV-screening JD.';
