-- Accessories table
CREATE TABLE IF NOT EXISTS tryon_schema.accessories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('shoes', 'glasses', 'jewellery', 'hats', 'gloves')),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES tryon_schema.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accessory images table
CREATE TABLE IF NOT EXISTS tryon_schema.accessory_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  accessory_id UUID NOT NULL REFERENCES tryon_schema.accessories(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  image_type TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_accessories_created_by ON tryon_schema.accessories(created_by);
CREATE INDEX IF NOT EXISTS idx_accessories_type ON tryon_schema.accessories(type);
CREATE INDEX IF NOT EXISTS idx_accessory_images_accessory_id ON tryon_schema.accessory_images(accessory_id);

-- Row Level Security (RLS) policies for accessories
ALTER TABLE tryon_schema.accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.accessory_images ENABLE ROW LEVEL SECURITY;

-- Policies for accessories table
CREATE POLICY "Users can view all accessories"
  ON tryon_schema.accessories
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create accessories"
  ON tryon_schema.accessories
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own accessories"
  ON tryon_schema.accessories
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own accessories"
  ON tryon_schema.accessories
  FOR DELETE
  USING (auth.uid() = created_by);

-- Policies for accessory_images table
CREATE POLICY "Users can view all accessory images"
  ON tryon_schema.accessory_images
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create accessory images"
  ON tryon_schema.accessory_images
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update accessory images for their accessories"
  ON tryon_schema.accessory_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.accessories
      WHERE accessories.id = accessory_images.accessory_id
      AND accessories.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete accessory images for their accessories"
  ON tryon_schema.accessory_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.accessories
      WHERE accessories.id = accessory_images.accessory_id
      AND accessories.created_by = auth.uid()
    )
  );

