-- Insert global "Blank" criteria template (company_id = NULL)
-- This template is available to all companies
INSERT INTO "public"."criteria" (
  "criteria_id", 
  "criteria_name", 
  "grid", 
  "company_id", 
  "jd_id",
  "created_at", 
  "updated_at"
) VALUES (
  gen_random_uuid(),
  'Blank',
  '[]'::jsonb,
  NULL,  -- Global - no company association
  NULL,  -- Default criteria (not tied to specific JD)
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;  -- Prevent duplicate insertion

-- Insert global "Default" criteria template (company_id = NULL)
-- This template is available to all companies
INSERT INTO "public"."criteria" (
  "criteria_id", 
  "criteria_name", 
  "grid", 
  "company_id", 
  "jd_id",
  "created_at", 
  "updated_at"
) VALUES (
  gen_random_uuid(),
  'Default',
  '[
    {
      "parameter": "Technical Skills",
      "weightage": 30,
      "calc_note": "Check the relevant experience in the given programming languages, frameworks, tools"
    },
    {
      "parameter": "Experience Level",
      "weightage": 25,
      "calc_note": "Years of relevant experience"
    },
    {
      "parameter": "Education",
      "weightage": 15,
      "calc_note": "Degree relevance and institution"
    },
    {
      "parameter": "Soft Skills",
      "weightage": 20,
      "calc_note": "Communication, leadership, teamwork"
    },
    {
      "parameter": "Stability",
      "weightage": 10,
      "calc_note": "Calculate the Stability Score based on the average years spent in each of the previous companies."
    }
  ]'::jsonb,
  NULL,  -- Global - no company association
  NULL,  -- Default criteria (not tied to specific JD)
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;  -- Prevent duplicate insertion
