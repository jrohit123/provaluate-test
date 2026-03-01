-- Create candidate row via trigger when a new auth user signs up with role = 'candidate'.
-- This avoids RLS blocking the insert (no session yet when confirm-email is required).
CREATE OR REPLACE FUNCTION public.handle_new_candidate_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role') = 'candidate' THEN
    INSERT INTO public.candidates (auth_user_id, email, first_name, last_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
      NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), '')
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users (Supabase Auth schema)
DROP TRIGGER IF EXISTS on_auth_user_created_candidate ON auth.users;
CREATE TRIGGER on_auth_user_created_candidate
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_candidate_user();
