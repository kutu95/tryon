-- Fix the handle_new_user trigger function to handle errors gracefully
-- This prevents user creation from failing if profile creation has issues

-- Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS tryon_schema.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION tryon_schema.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with error handling
  -- Use ON CONFLICT to prevent failures if profile already exists
  INSERT INTO tryon_schema.profiles (id, role, display_name)
  VALUES (
    NEW.id, 
    'viewer', 
    COALESCE(NEW.email, 'user')
  )
  ON CONFLICT (id) DO NOTHING;  -- Don't fail if profile already exists
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    -- This allows users to be created even if profile creation fails
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;  -- Still allow user creation to succeed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION tryon_schema.handle_new_user();

