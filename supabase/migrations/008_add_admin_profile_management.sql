-- Add RLS policies to allow admins to manage all user profiles
-- This enables the admin user management page to update roles and display names

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON tryon_schema.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
  ON tryon_schema.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Allow admins to insert profiles (for new user creation)
CREATE POLICY "Admins can create profiles"
  ON tryon_schema.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

