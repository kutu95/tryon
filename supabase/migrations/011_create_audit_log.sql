-- Create audit log table for tracking app events
-- This table will store events like login attempts, record creation, deletions, etc.

CREATE TABLE IF NOT EXISTS tryon_schema.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES tryon_schema.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'login_attempt',
    'login_success',
    'login_failure',
    'actor_created',
    'actor_updated',
    'actor_deleted',
    'garment_created',
    'garment_updated',
    'garment_deleted',
    'look_board_created',
    'look_board_updated',
    'look_board_deleted',
    'look_item_created',
    'look_item_deleted',
    'tryon_created',
    'tryon_updated',
    'accessory_created',
    'accessory_updated',
    'accessory_deleted',
    'user_created',
    'user_updated',
    'user_deleted',
    'role_changed'
  )),
  resource_type TEXT, -- e.g., 'actor', 'garment', 'look_board', etc.
  resource_id UUID, -- ID of the affected resource
  details JSONB, -- Additional event details (e.g., what changed, error messages)
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_audit_log_user_id ON tryon_schema.audit_log(user_id);
CREATE INDEX idx_audit_log_event_type ON tryon_schema.audit_log(event_type);
CREATE INDEX idx_audit_log_resource_type ON tryon_schema.audit_log(resource_type);
CREATE INDEX idx_audit_log_created_at ON tryon_schema.audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE tryon_schema.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
  ON tryon_schema.audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tryon_schema.profiles
      WHERE tryon_schema.profiles.id = auth.uid()
      AND tryon_schema.profiles.role = 'admin'
    )
  );

-- Service role can insert audit logs (for server-side logging)
-- This is handled by the admin client which bypasses RLS

-- Grant permissions
GRANT USAGE ON SCHEMA tryon_schema TO service_role;
GRANT INSERT, SELECT ON tryon_schema.audit_log TO service_role;
GRANT SELECT ON tryon_schema.audit_log TO authenticated;

