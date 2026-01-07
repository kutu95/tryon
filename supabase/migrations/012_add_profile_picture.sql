-- Add profile_picture_path column to profiles table
ALTER TABLE tryon_schema.profiles
ADD COLUMN IF NOT EXISTS profile_picture_path TEXT;

-- Create index for profile picture lookups (optional, but can help with queries)
CREATE INDEX IF NOT EXISTS idx_profiles_profile_picture_path ON tryon_schema.profiles(profile_picture_path) WHERE profile_picture_path IS NOT NULL;

