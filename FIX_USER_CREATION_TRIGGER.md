# Fixing "Database error creating new user"

The error indicates the `handle_new_user()` trigger is failing when trying to create the profile.

## Step 1: Check the Trigger Function

Run this in Supabase Studio SQL Editor:

```sql
-- Check the trigger function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Check if the trigger exists and is enabled
SELECT 
    tgname AS trigger_name,
    tgenabled AS is_enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgname = 'on_auth_user_created';
```

## Step 2: Test the Trigger Function Manually

```sql
-- Check if we can insert into profiles (test permissions)
-- First, let's see what happens when we try to create a test profile
-- (We'll delete it after)

-- Check current user context
SELECT current_user, session_user;

-- Check if the function has the right permissions
SELECT 
    p.proname,
    p.prosecdef,  -- Should be true for SECURITY DEFINER
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.proname = 'handle_new_user';
```

## Step 3: Fix the Trigger Function

The issue might be that the function needs better error handling. Let's update it:

```sql
-- Drop and recreate the function with better error handling
DROP FUNCTION IF EXISTS tryon_schema.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION tryon_schema.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with error handling
  INSERT INTO tryon_schema.profiles (id, role, display_name)
  VALUES (NEW.id, 'viewer', COALESCE(NEW.email, 'user'))
  ON CONFLICT (id) DO NOTHING;  -- Don't fail if profile already exists
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;  -- Still allow user creation to succeed
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION tryon_schema.handle_new_user();
```

## Step 4: Alternative - Disable Trigger Temporarily

If the above doesn't work, you can temporarily disable the trigger, create the user, then manually create the profile:

```sql
-- Disable the trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```

Then create the user via curl or Studio, create the profile manually, then re-enable:

```sql
-- Create admin profile manually
INSERT INTO tryon_schema.profiles (id, role, display_name)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com'
ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', 
      display_name = 'Kristinaknab79@gmail.com',
      updated_at = NOW();

-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

## Step 5: Check for Schema/Table Issues

```sql
-- Verify schema exists
SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'tryon_schema';

-- Verify profiles table exists and structure
\d tryon_schema.profiles

-- Or using SQL:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'tryon_schema' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

