-- Grant permissions to service_role for admin operations
-- The service_role is used when authenticating with the service role key
-- This allows the admin client to bypass RLS and access all tables

-- Grant schema usage
GRANT USAGE ON SCHEMA tryon_schema TO service_role;

-- Grant all table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tryon_schema TO service_role;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA tryon_schema 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

