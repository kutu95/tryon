# Fix for User Creation Error

The database error is likely caused by the `handle_new_user()` trigger. Let's check and fix it.

## Step 1: Check the actual error

Run this in Supabase Studio SQL Editor to see the detailed error:

```sql
-- Check if there are any issues with the trigger
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

## Step 2: Try creating user with email_confirm=false first

Sometimes the trigger fails if email_confirmed_at is set immediately. Try:

```bash
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

curl -X POST "http://localhost:54321/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Kristinaknab79@gmail.com",
    "password": "TempPassword123!",
    "email_confirm": false
  }'
```

Then manually confirm the email and create the profile.

## Step 3: Temporarily disable the trigger (if needed)

If the trigger is causing issues, you can temporarily disable it:

```sql
-- Disable the trigger temporarily
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
```

Then create the user via curl, then manually create the profile, then re-enable:

```sql
-- Re-enable the trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
```

## Step 4: Manual creation (most reliable)

If all else fails, manually create the user record and profile:

1. **Create user record directly** (requires admin access):
```sql
-- This bypasses the trigger issues
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
SELECT 
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'Kristinaknab79@gmail.com',
  crypt('TempPassword123!', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'Kristinaknab79@gmail.com'
)
RETURNING id;
```

2. **Then create the admin profile**:
```sql
INSERT INTO tryon_schema.profiles (id, role, display_name)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com'
ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', 
      display_name = 'Kristinaknab79@gmail.com',
      updated_at = NOW();
```

