-- Create function to validate email domain for company access
CREATE OR REPLACE FUNCTION public.validate_company_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if email ends with @goensol.com
  IF NEW.email NOT LIKE '%@goensol.com' THEN
    RAISE EXCEPTION 'Only @goensol.com email addresses are allowed to sign up';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to run before user creation
DROP TRIGGER IF EXISTS validate_company_email_trigger ON auth.users;
CREATE TRIGGER validate_company_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_company_email();