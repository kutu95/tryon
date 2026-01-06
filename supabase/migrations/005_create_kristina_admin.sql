-- Create admin profile for Kristinaknab79@gmail.com
-- IMPORTANT: The user must be created first using one of these methods:
-- 
-- Method 1: Use Supabase CLI (recommended)
--   supabase auth users create --email Kristinaknab79@gmail.com --password TempPassword123!
--
-- Method 2: Use curl with Management API
--   curl -X POST 'http://localhost:54321/auth/v1/admin/users' \
--     -H "apikey: YOUR_SERVICE_ROLE_KEY" \
--     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"email":"Kristinaknab79@gmail.com","password":"TempPassword123!","email_confirm":true}'
--
-- Method 3: Use the Supabase JS Admin client (if you have a script)
--
-- After the user is created, run this migration to create the admin profile.

-- Create or update profile with admin role
INSERT INTO tryon_schema.profiles (id, role, display_name)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com'
ON CONFLICT (id) DO UPDATE 
  SET role = 'admin', 
      display_name = 'Kristinaknab79@gmail.com',
      updated_at = NOW();

