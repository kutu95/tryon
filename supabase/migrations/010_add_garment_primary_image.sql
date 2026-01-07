-- Add is_primary field to garment_images table
-- This allows garments to have a primary image displayed on the cards, similar to actors

ALTER TABLE tryon_schema.garment_images 
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_garment_images_is_primary ON tryon_schema.garment_images(garment_id, is_primary) WHERE is_primary = TRUE;

