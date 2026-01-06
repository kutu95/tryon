-- Create the tryon_schema schema
CREATE SCHEMA IF NOT EXISTS tryon_schema;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table
CREATE TABLE tryon_schema.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'stylist', 'viewer')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actors table
CREATE TABLE tryon_schema.actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES tryon_schema.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actor photos table
CREATE TABLE tryon_schema.actor_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES tryon_schema.actors(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  is_primary BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garments table
CREATE TABLE tryon_schema.garments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES tryon_schema.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garment images table
CREATE TABLE tryon_schema.garment_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  garment_id UUID NOT NULL REFERENCES tryon_schema.garments(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  image_type TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Try-on jobs table
CREATE TABLE tryon_schema.tryon_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_photo_id UUID NOT NULL REFERENCES tryon_schema.actor_photos(id),
  garment_image_id UUID NOT NULL REFERENCES tryon_schema.garment_images(id),
  provider TEXT NOT NULL,
  provider_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  error_message TEXT,
  result_storage_path TEXT,
  settings JSONB,
  created_by UUID NOT NULL REFERENCES tryon_schema.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Look boards table
CREATE TABLE tryon_schema.look_boards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES tryon_schema.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Look items table
CREATE TABLE tryon_schema.look_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  look_board_id UUID NOT NULL REFERENCES tryon_schema.look_boards(id) ON DELETE CASCADE,
  tryon_job_id UUID REFERENCES tryon_schema.tryon_jobs(id) ON DELETE SET NULL,
  label TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX idx_actors_created_by ON tryon_schema.actors(created_by);
CREATE INDEX idx_actor_photos_actor_id ON tryon_schema.actor_photos(actor_id);
CREATE INDEX idx_garments_created_by ON tryon_schema.garments(created_by);
CREATE INDEX idx_garment_images_garment_id ON tryon_schema.garment_images(garment_id);
CREATE INDEX idx_tryon_jobs_created_by ON tryon_schema.tryon_jobs(created_by);
CREATE INDEX idx_tryon_jobs_status ON tryon_schema.tryon_jobs(status);
CREATE INDEX idx_look_boards_created_by ON tryon_schema.look_boards(created_by);
CREATE INDEX idx_look_items_look_board_id ON tryon_schema.look_items(look_board_id);
CREATE INDEX idx_look_items_tryon_job_id ON tryon_schema.look_items(tryon_job_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE tryon_schema.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.actor_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.garments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.garment_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.tryon_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.look_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tryon_schema.look_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON tryon_schema.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON tryon_schema.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Actors policies
CREATE POLICY "All authenticated users can view actors"
  ON tryon_schema.actors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and stylist can create actors"
  ON tryon_schema.actors FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can update actors"
  ON tryon_schema.actors FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin can delete actors"
  ON tryon_schema.actors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Actor photos policies
CREATE POLICY "All authenticated users can view actor photos"
  ON tryon_schema.actor_photos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and stylist can create actor photos"
  ON tryon_schema.actor_photos FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can update actor photos"
  ON tryon_schema.actor_photos FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can delete actor photos"
  ON tryon_schema.actor_photos FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

-- Garments policies
CREATE POLICY "All authenticated users can view garments"
  ON tryon_schema.garments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and stylist can create garments"
  ON tryon_schema.garments FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can update garments"
  ON tryon_schema.garments FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin can delete garments"
  ON tryon_schema.garments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Garment images policies
CREATE POLICY "All authenticated users can view garment images"
  ON tryon_schema.garment_images FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin and stylist can create garment images"
  ON tryon_schema.garment_images FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can update garment images"
  ON tryon_schema.garment_images FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can delete garment images"
  ON tryon_schema.garment_images FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

-- Try-on jobs policies
CREATE POLICY "Users can view their own try-on jobs"
  ON tryon_schema.tryon_jobs FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Admin and stylist can view all try-on jobs"
  ON tryon_schema.tryon_jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can create try-on jobs"
  ON tryon_schema.tryon_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "System can update try-on jobs"
  ON tryon_schema.tryon_jobs FOR UPDATE
  USING (true); -- Service role will handle updates

-- Look boards policies
CREATE POLICY "Users can view their own look boards"
  ON tryon_schema.look_boards FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Admin and stylist can view all look boards"
  ON tryon_schema.look_boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can create look boards"
  ON tryon_schema.look_boards FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can update look boards"
  ON tryon_schema.look_boards FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin can delete look boards"
  ON tryon_schema.look_boards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Look items policies
CREATE POLICY "Users can view look items for their boards"
  ON tryon_schema.look_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.look_boards
      WHERE tryon_schema.look_boards.id = tryon_schema.look_items.look_board_id
      AND tryon_schema.look_boards.created_by = auth.uid()
    )
  );

CREATE POLICY "Admin and stylist can view all look items"
  ON tryon_schema.look_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can create look items"
  ON tryon_schema.look_items FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    ) AND
    EXISTS (
      SELECT 1 FROM tryon_schema.look_boards
      WHERE tryon_schema.look_boards.id = tryon_schema.look_items.look_board_id
      AND (
        tryon_schema.look_boards.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM tryon_schema.profiles
          WHERE tryon_schema.profiles.id = auth.uid()
          AND tryon_schema.profiles.role IN ('admin', 'stylist')
        )
      )
    )
  );

CREATE POLICY "Admin and stylist can update look items"
  ON tryon_schema.look_items FOR UPDATE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

CREATE POLICY "Admin and stylist can delete look items"
  ON tryon_schema.look_items FOR DELETE
  USING (
    auth.role() = 'authenticated' AND
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role IN ('admin', 'stylist')
    )
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION tryon_schema.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO tryon_schema.profiles (id, role, display_name)
  VALUES (NEW.id, 'viewer', NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION tryon_schema.handle_new_user();

-- Grant schema permissions for PostgREST to discover and access tables
GRANT USAGE ON SCHEMA tryon_schema TO authenticator;
GRANT USAGE ON SCHEMA tryon_schema TO anon;
GRANT USAGE ON SCHEMA tryon_schema TO authenticated;

-- Grant SELECT on all tables for schema discovery
GRANT SELECT ON ALL TABLES IN SCHEMA tryon_schema TO authenticator;
GRANT SELECT ON ALL TABLES IN SCHEMA tryon_schema TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA tryon_schema TO authenticated;

-- Grant INSERT, UPDATE, DELETE on all tables for authenticated users
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tryon_schema TO authenticated;

-- Grant on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA tryon_schema 
  GRANT SELECT ON TABLES TO authenticator, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA tryon_schema 
  GRANT INSERT, UPDATE, DELETE ON TABLES TO authenticated;
