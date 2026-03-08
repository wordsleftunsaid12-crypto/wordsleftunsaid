-- Add youtube to all platform CHECK constraints (idempotent: drop if exists then re-add)

ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS content_queue_platform_check;
ALTER TABLE content_queue ADD CONSTRAINT content_queue_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'youtube'));

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_platform_check;
ALTER TABLE posts ADD CONSTRAINT posts_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'youtube'));

ALTER TABLE schedule_config DROP CONSTRAINT IF EXISTS schedule_config_platform_check;
ALTER TABLE schedule_config ADD CONSTRAINT schedule_config_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'youtube'));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follower_snapshots') THEN
    ALTER TABLE follower_snapshots DROP CONSTRAINT IF EXISTS follower_snapshots_platform_check;
    ALTER TABLE follower_snapshots ADD CONSTRAINT follower_snapshots_platform_check
      CHECK (platform IN ('instagram', 'tiktok', 'youtube'));
  END IF;
END $$;

ALTER TABLE outbound_engagement DROP CONSTRAINT IF EXISTS outbound_engagement_platform_check;
ALTER TABLE outbound_engagement ADD CONSTRAINT outbound_engagement_platform_check
  CHECK (platform IN ('instagram', 'tiktok', 'youtube'));
