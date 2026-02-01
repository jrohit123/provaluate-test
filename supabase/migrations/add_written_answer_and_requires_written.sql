-- Written-answer feature: separate box for SQL/code/calculations + spoken explanation.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query) before using the feature.

-- Add written_answer to answers table (for SQL/code/calculations typed in a separate box)
ALTER TABLE public.answers
  ADD COLUMN IF NOT EXISTS written_answer text NULL;

COMMENT ON COLUMN public.answers.written_answer IS 'Optional: SQL query, code snippet, or calculation written by the candidate when the question requires a written answer.';

-- Add requires_written_answer to questions table (so frontend shows written-answer box when true)
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS requires_written_answer boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.questions.requires_written_answer IS 'When true, the candidate must fill both the transcription box (speech) and the written-answer box (e.g. SQL/code) before submitting.';
