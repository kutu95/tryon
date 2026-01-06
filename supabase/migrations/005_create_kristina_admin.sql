-- Create admin profile for Kristinaknab79@gmail.com
-- IMPORTANT: The user must be created first through Supabase Studio Authentication UI
-- Steps:
-- 1. Go to Supabase Studio > Authentication > Users
-- 2. Click "Add user" 
-- 3. Enter email: Kristinaknab79@gmail.com
-- 4. Set a temporary password (user can change it on first login)
-- 5. Confirm the email
-- 6. Then run this migration to create the admin profile

-- Create or update profile with admin role
INSERT INTO tryon_schema.profiles (id, role, display_name)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com'
ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', 
      display_name = 'Kristinaknab79@gmail.com',
      updated_at = NOW();

