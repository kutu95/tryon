-- Create profile for existing user john@streamtime.com.au
INSERT INTO tryon_schema.profiles (id, role, display_name)
SELECT id, 'admin', email
FROM auth.users
WHERE email = 'john@streamtime.com.au'
ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = 'john@streamtime.com.au';

