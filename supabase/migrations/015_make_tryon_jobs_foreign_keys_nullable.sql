-- Make actor_photo_id and garment_image_id nullable in tryon_jobs
-- This allows cleaning up references when photos are deleted (if not saved to look boards)

-- Drop the existing foreign key constraints
ALTER TABLE tryon_schema.tryon_jobs
  DROP CONSTRAINT IF EXISTS tryon_jobs_actor_photo_id_fkey;

ALTER TABLE tryon_schema.tryon_jobs
  DROP CONSTRAINT IF EXISTS tryon_jobs_garment_image_id_fkey;

-- Make the columns nullable
ALTER TABLE tryon_schema.tryon_jobs
  ALTER COLUMN actor_photo_id DROP NOT NULL;

ALTER TABLE tryon_schema.tryon_jobs
  ALTER COLUMN garment_image_id DROP NOT NULL;

-- Re-add foreign key constraints with ON DELETE SET NULL
ALTER TABLE tryon_schema.tryon_jobs
  ADD CONSTRAINT tryon_jobs_actor_photo_id_fkey
  FOREIGN KEY (actor_photo_id)
  REFERENCES tryon_schema.actor_photos(id)
  ON DELETE SET NULL;

ALTER TABLE tryon_schema.tryon_jobs
  ADD CONSTRAINT tryon_jobs_garment_image_id_fkey
  FOREIGN KEY (garment_image_id)
  REFERENCES tryon_schema.garment_images(id)
  ON DELETE SET NULL;
