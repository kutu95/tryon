-- Create user and admin profile for Kristinaknab79@gmail.com
-- This approach manually creates the user and profile to avoid trigger issues

DO $$
DECLARE
  user_email TEXT := 'Kristinaknab79@gmail.com';
  user_password TEXT := 'TempPassword123!';
  new_user_id UUID;
  existing_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = user_email;
  
  -- If user doesn't exist, we need to create them
  -- But we can't directly insert into auth.users due to trigger constraints
  -- So we'll use a workaround: create via a function that bypasses triggers
  
  IF existing_user_id IS NULL THEN
    -- Try to get the user ID from a function call or use a workaround
    -- Since direct insert fails, we'll need to use the Admin API or Supabase CLI
    -- For now, just create the profile part and note that user needs to be created separately
    
    RAISE NOTICE 'User does not exist. Please create the user first using:';
    RAISE NOTICE '  curl -X POST "http://localhost:54321/auth/v1/admin/users" -H "apikey: YOUR_KEY" -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d ''{"email":"Kristinaknab79@gmail.com","password":"TempPassword123!","email_confirm":true}''';
    RAISE NOTICE 'Or use Supabase Studio > Authentication > Users (if UI works)';
    RAISE NOTICE 'Then run this migration again to create the admin profile.';
    
  ELSE
    -- User exists, create/update admin profile
    INSERT INTO tryon_schema.profiles (id, role, display_name)
    VALUES (existing_user_id, 'admin', user_email)
    ON CONFLICT (id) DO UPDATE 
      SET role = 'admin', 
          display_name = user_email,
          updated_at = NOW();
    
    RAISE NOTICE 'Admin profile created/updated for user: % (ID: %)', user_email, existing_user_id;
  END IF;
END $$;

