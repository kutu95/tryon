-- This script marks existing migrations as applied
-- Run this ONCE if your database was set up before migrations were tracked
-- 
-- Usage: psql -h localhost -p 54322 -U postgres -d postgres -f mark_existing_migrations.sql
-- Or use: supabase db execute --file mark_existing_migrations.sql

-- Ensure the supabase_migrations schema exists
CREATE SCHEMA IF NOT EXISTS supabase_migrations;

-- Create the schema_migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version TEXT PRIMARY KEY,
  statements TEXT[],
  name TEXT
);

-- Mark all existing migrations as applied (up to 012)
-- Only mark migrations that have actually been applied to your database
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES 
  ('001_initial_schema', ARRAY[]::TEXT[], 'initial_schema'),
  ('002_reconstruct_public_schema', ARRAY[]::TEXT[], 'reconstruct_public_schema'),
  ('003_create_profile_for_john', ARRAY[]::TEXT[], 'create_profile_for_john'),
  ('004_add_accessories', ARRAY[]::TEXT[], 'add_accessories'),
  ('005_create_kristina_admin', ARRAY[]::TEXT[], 'create_kristina_admin'),
  ('006_fix_user_creation_kristina', ARRAY[]::TEXT[], 'fix_user_creation_kristina'),
  ('007_fix_handle_new_user_trigger', ARRAY[]::TEXT[], 'fix_handle_new_user_trigger'),
  ('008_add_admin_profile_management', ARRAY[]::TEXT[], 'add_admin_profile_management'),
  ('009_grant_service_role_permissions', ARRAY[]::TEXT[], 'grant_service_role_permissions'),
  ('010_add_garment_primary_image', ARRAY[]::TEXT[], 'add_garment_primary_image'),
  ('011_create_audit_log', ARRAY[]::TEXT[], 'create_audit_log'),
  ('012_add_profile_picture', ARRAY[]::TEXT[], 'add_profile_picture')
ON CONFLICT (version) DO NOTHING;

-- Verify the migrations were marked
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

