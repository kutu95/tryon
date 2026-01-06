-- Create user and admin profile for Kristinaknab79@gmail.com
-- This will create the user in auth.users and the profile in tryon_schema.profiles
-- Run this in Supabase Studio SQL Editor

DO $$
DECLARE
  new_user_id UUID;
  user_email TEXT := 'Kristinaknab79@gmail.com';
  user_password TEXT := 'TempPassword123!'; -- User should change this on first login
  existing_user_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO existing_user_id
  FROM auth.users
  WHERE email = user_email;
  
  -- If user doesn't exist, create them
  IF existing_user_id IS NULL THEN
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
    );
  ELSE
    new_user_id := existing_user_id;
  END IF;
  
  -- Create or update admin profile
  INSERT INTO tryon_schema.profiles (id, role, display_name)
  VALUES (new_user_id, 'admin', user_email)
  ON CONFLICT (id) DO UPDATE 
    SET role = 'admin', 
        display_name = user_email,
        updated_at = NOW();
        
  RAISE NOTICE 'User % created/updated with admin role. ID: %', user_email, new_user_id;
END $$;

