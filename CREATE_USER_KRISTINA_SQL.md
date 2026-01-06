# Create User for Kristinaknab79@gmail.com - SQL Method

If Supabase Studio UI is giving a 400 error, you can create the user directly via SQL.

## Method 1: Using Supabase SQL Editor (Recommended)

1. Go to Supabase Studio > **SQL Editor**
2. Run this SQL script:

```sql
-- Create user and admin profile for Kristinaknab79@gmail.com
DO $$
DECLARE
  new_user_id UUID;
  user_email TEXT := 'Kristinaknab79@gmail.com';
  user_password TEXT := 'TempPassword123!'; -- User should change this on first login
BEGIN
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  )
  ON CONFLICT (email) DO NOTHING
  RETURNING id INTO new_user_id;
  
  -- If user was created or already exists, get their ID
  IF new_user_id IS NULL THEN
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = user_email;
  END IF;
  
  -- Create admin profile
  INSERT INTO tryon_schema.profiles (id, role, display_name)
  VALUES (new_user_id, 'admin', user_email)
  ON CONFLICT (id) DO UPDATE 
    SET role = 'admin', 
        display_name = user_email,
        updated_at = NOW();
        
  RAISE NOTICE 'User created with ID: %', new_user_id;
END $$;
```

## Method 2: Simpler approach (if Method 1 fails)

If the above doesn't work, try this step-by-step approach:

### Step 1: Check if user already exists
```sql
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'Kristinaknab79@gmail.com';
```

### Step 2: If user doesn't exist, create via Supabase CLI or use the Supabase Admin API

Alternatively, you can use the Supabase Management API or CLI. But the easiest is to:

1. **Use Supabase CLI** (if available):
```bash
supabase auth users create --email Kristinaknab79@gmail.com --password TempPassword123!
```

2. **Or use curl with the Management API** (requires project ref and service role key):
```bash
curl -X POST 'https://api.supabase.com/v1/projects/{project-ref}/auth/users' \
  -H "Authorization: Bearer {service-role-key}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Kristinaknab79@gmail.com",
    "password": "TempPassword123!",
    "email_confirm": true
  }'
```

### Step 3: Once user exists, create the profile
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

## Verify the user was created

```sql
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.display_name
FROM auth.users u
LEFT JOIN tryon_schema.profiles p ON u.id = p.id
WHERE u.email = 'Kristinaknab79@gmail.com';
```

## Troubleshooting the 400 Error

The 400 error in Supabase Studio could be due to:

1. **Email format**: Make sure the email is valid
2. **Password requirements**: Supabase requires:
   - Minimum 6 characters
   - Should contain letters and numbers
3. **Browser console**: Check the browser console for more detailed error messages
4. **Network issues**: Try refreshing the page

If the UI continues to fail, use the SQL method above.

