# Creating User for Kristinaknab79@gmail.com

## Option 1: Using Supabase Studio (Recommended)

1. **Create the user in Authentication:**
   - Go to Supabase Studio (http://localhost:54323 or your Supabase URL)
   - Navigate to **Authentication** > **Users**
   - Click **"Add user"** or **"Invite user"**
   - Enter email: `Kristinaknab79@gmail.com`
   - Set a temporary password (user should change it on first login)
   - Make sure **"Auto Confirm User"** is checked
   - Click **"Create user"**

2. **Create the admin profile:**
   - Go to **SQL Editor** in Supabase Studio
   - Run the migration file: `supabase/migrations/005_create_kristina_admin.sql`
   - Or run this SQL directly:
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

## Option 2: Using Supabase CLI

If you prefer to use the CLI:

1. **Create the user:**
   ```bash
   # This requires the Supabase CLI and proper setup
   # You may need to use the Supabase Dashboard instead
   ```

2. **Run the migration:**
   ```bash
   cd ~/supabase-local/supabase
   supabase migration up
   ```

## Option 3: Direct SQL (if user already exists)

If the user already exists in `auth.users`, you can just run:

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

Run this query to verify:

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

You should see:
- The user in `auth.users`
- A profile with `role = 'admin'` in `tryon_schema.profiles`

