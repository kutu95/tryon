-- Create settings table to store FASHN API key and other configuration
CREATE TABLE IF NOT EXISTS tryon_schema.settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for key lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON tryon_schema.settings(key);

-- Enable RLS
ALTER TABLE tryon_schema.settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Only admins can view settings"
  ON tryon_schema.settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Only admins can update settings
CREATE POLICY "Only admins can update settings"
  ON tryon_schema.settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Only admins can insert settings
CREATE POLICY "Only admins can insert settings"
  ON tryon_schema.settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT USAGE ON SCHEMA tryon_schema TO authenticator;
GRANT USAGE ON SCHEMA tryon_schema TO anon;
GRANT USAGE ON SCHEMA tryon_schema TO authenticated;
GRANT SELECT, INSERT, UPDATE ON tryon_schema.settings TO authenticated;

-- Grant permissions to service_role for admin operations
GRANT USAGE ON SCHEMA tryon_schema TO service_role;
GRANT SELECT, INSERT, UPDATE ON tryon_schema.settings TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA tryon_schema 
  GRANT SELECT, INSERT, UPDATE ON TABLES TO service_role;

-- Insert initial FASHN_API_KEY setting if it doesn't exist
-- This will be populated from environment variable on first use
INSERT INTO tryon_schema.settings (key, description)
VALUES ('fashn_api_key', 'FASHN AI API Key for virtual try-on service')
ON CONFLICT (key) DO NOTHING;

