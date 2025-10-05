-- =====================================================
-- InsureVis role propagation helper
-- Run this migration in Supabase SQL editor to make sure
-- roles chosen during sign-up are reflected in public.users.
-- =====================================================

-- Helper function to normalise incoming role values
CREATE OR REPLACE FUNCTION public.normalize_portal_role(role_input text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
    normalized text;
BEGIN
    IF role_input IS NULL THEN
        RETURN 'user';
    END IF;

    normalized := lower(trim(role_input));
    normalized := replace(normalized, ' ', '_');
    normalized := replace(normalized, '-', '_');

    IF normalized LIKE '%car%company%' THEN
        RETURN 'car_company';
    ELSIF normalized LIKE '%insurance%company%' THEN
        RETURN 'insurance_company';
    ELSIF normalized LIKE '%admin%' THEN
        RETURN 'admin';
    END IF;

    RETURN 'user';
END;
$$;

-- Store role metadata consistently when new auth users are created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    preferred_role text;
BEGIN
  preferred_role := public.normalize_portal_role(
      coalesce(
          NEW.raw_user_meta_data->>'role',
          NEW.raw_user_meta_data->>'portal_role',
          NEW.raw_user_meta_data->>'portalRole',
          NEW.raw_app_meta_data->>'role',
          NEW.raw_app_meta_data->>'portal_role',
          NEW.raw_app_meta_data->>'portalRole'
      )
  );

  INSERT INTO public.users (id, name, email, is_email_verified, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL,
    preferred_role
  );
  
  INSERT INTO public.user_stats (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Keep public.users.role in sync when auth metadata changes
CREATE OR REPLACE FUNCTION public.sync_user_email_and_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    preferred_role text;
BEGIN
  preferred_role := public.normalize_portal_role(
      coalesce(
          NEW.raw_user_meta_data->>'role',
          NEW.raw_user_meta_data->>'portal_role',
          NEW.raw_user_meta_data->>'portalRole',
          NEW.raw_app_meta_data->>'role',
          NEW.raw_app_meta_data->>'portal_role',
          NEW.raw_app_meta_data->>'portalRole'
      )
  );

  UPDATE public.users 
  SET is_email_verified = (NEW.email_confirmed_at IS NOT NULL),
      role = preferred_role,
      updated_at = now()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Replace the existing trigger with the new function
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_user_email_and_role();

-- Optional: backfill existing users who are still marked as the default 'user'
-- Uncomment the UPDATE below to run a one-time normalisation over current records.
-- UPDATE public.users u
-- SET role = public.normalize_portal_role(
--     coalesce(
--       au.raw_user_meta_data->>'role',
--       au.raw_user_meta_data->>'portal_role',
--       au.raw_user_meta_data->>'portalRole',
--       au.raw_app_meta_data->>'role',
--       au.raw_app_meta_data->>'portal_role',
--       au.raw_app_meta_data->>'portalRole'
--     )
-- )
-- FROM auth.users au
-- WHERE u.id = au.id
--   AND (u.role IS NULL OR u.role = 'user');
