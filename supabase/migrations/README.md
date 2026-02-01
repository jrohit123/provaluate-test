# Supabase migrations

Run these in **Supabase Dashboard → SQL Editor → New query**, then execute.

## Written-answer feature

**File:** `add_written_answer_and_requires_written.sql`

Adds:

- **`public.answers.written_answer`** (text, nullable) – Stores SQL/code/calculations the candidate types when a question requires a written answer.
- **`public.questions.requires_written_answer`** (boolean, default false) – When true, the UI shows a written-answer box and requires both transcript and written answer before submit.

Run this migration before using the dedicated written-answer (SQL/code) feature in the AI interview flow.
