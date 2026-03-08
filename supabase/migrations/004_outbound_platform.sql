-- Add platform column to outbound_engagement for multi-platform tracking
ALTER TABLE outbound_engagement
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'instagram';

-- Add check constraint only if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'outbound_engagement' AND constraint_name = 'outbound_engagement_platform_check'
  ) THEN
    ALTER TABLE outbound_engagement ADD CONSTRAINT outbound_engagement_platform_check
      CHECK (platform IN ('instagram', 'tiktok'));
  END IF;
END $$;

-- Update index to include platform for efficient per-platform queries
DROP INDEX IF EXISTS idx_outbound_engagement_action;
CREATE INDEX IF NOT EXISTS idx_outbound_engagement_action_platform
  ON outbound_engagement(platform, action_type, created_at);
