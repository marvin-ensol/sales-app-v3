-- Drop the old trigger-based approach since we're using auth hooks
DROP TRIGGER IF EXISTS validate_company_email_trigger ON auth.users;

-- Create the correct auth hook function that accepts and returns JSONB
CREATE OR REPLACE FUNCTION public.validate_company_email_hook(user_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  -- Extract email from the user data
  user_email := user_data->>'email';
  
  -- Check if email ends with @goensol.com
  IF user_email NOT LIKE '%@goensol.com' THEN
    RAISE EXCEPTION 'Only @goensol.com email addresses are allowed to sign up';
  END IF;
  
  -- Return the user data unchanged if validation passes
  RETURN user_data;
END;
$$;