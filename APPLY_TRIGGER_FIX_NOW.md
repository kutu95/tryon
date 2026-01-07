# Apply Trigger Fix - Step by Step

The trigger fix needs to be applied. Here's how:

## Step 1: Run the Migration

On your server:

```bash
cd ~/supabase-local/supabase
supabase migration up
```

This will apply migration `007_fix_handle_new_user_trigger.sql`.

## Step 2: Or Run the SQL Directly

If migrations don't work, run this SQL directly in Supabase Studio SQL Editor:

```sql
-- Fix the trigger function to handle errors gracefully
DROP FUNCTION IF EXISTS tryon_schema.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION tryon_schema.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile with error handling
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

## Step 3: Verify the Fix

```sql
-- Check the function has the EXCEPTION block
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';
```

You should see `EXCEPTION` and `ON CONFLICT DO NOTHING` in the output.

## Step 4: Test User Creation Again

After applying the fix, try creating the user again via curl:

```bash
cd ~/apps/tryon
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

curl -X POST "http://localhost:54321/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Kristinaknab79@gmail.com",
    "password": "TempPassword123!",
    "email_confirm": true
  }'
```

## Step 5: If Still Failing - Check What's Actually Wrong

If it still fails, we need to see what the actual database error is. The trigger might be catching it but we need to see the warning:

```sql
-- Check PostgreSQL logs for the WARNING message
-- Or temporarily make the function raise an error instead of warning
-- to see what's actually failing
```

Or we can temporarily disable the trigger entirely:

```sql
-- Disable trigger
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```

Then create the user, create the profile manually, then re-enable.

