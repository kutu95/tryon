-- Add metadata JSONB field to actor_photos and garment_images for storing OpenAI tuning metadata
ALTER TABLE tryon_schema.actor_photos 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE tryon_schema.garment_images 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add parent_photo_id to track original photo for tuned variants
ALTER TABLE tryon_schema.actor_photos 
ADD COLUMN IF NOT EXISTS parent_photo_id UUID REFERENCES tryon_schema.actor_photos(id) ON DELETE SET NULL;

ALTER TABLE tryon_schema.garment_images 
ADD COLUMN IF NOT EXISTS parent_image_id UUID REFERENCES tryon_schema.garment_images(id) ON DELETE SET NULL;

-- Create indexes for metadata queries
CREATE INDEX IF NOT EXISTS idx_actor_photos_metadata ON tryon_schema.actor_photos USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_garment_images_metadata ON tryon_schema.garment_images USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_actor_photos_parent ON tryon_schema.actor_photos(parent_photo_id);
CREATE INDEX IF NOT EXISTS idx_garment_images_parent ON tryon_schema.garment_images(parent_image_id);
