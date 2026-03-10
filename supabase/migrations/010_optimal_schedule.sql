-- Seed schedule_config with per-platform optimal posting hours.
-- Hours are in Pacific Time (America/Los_Angeles), converted to UTC at runtime.

-- Instagram: morning scroll, lunch, after-work
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('instagram', 7, 'America/Los_Angeles', 3),
  ('instagram', 12, 'America/Los_Angeles', 3),
  ('instagram', 17, 'America/Los_Angeles', 3);

-- TikTok: late morning, afternoon, evening
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('tiktok', 10, 'America/Los_Angeles', 3),
  ('tiktok', 14, 'America/Los_Angeles', 3),
  ('tiktok', 19, 'America/Los_Angeles', 3);

-- YouTube: afternoon discovery, pre-evening
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('youtube', 14, 'America/Los_Angeles', 2),
  ('youtube', 17, 'America/Los_Angeles', 2);

-- Reddit: morning commute, evening browsing
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('reddit', 8, 'America/Los_Angeles', 2),
  ('reddit', 18, 'America/Los_Angeles', 2);

-- Pinterest: evening planning sessions
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('pinterest', 20, 'America/Los_Angeles', 2),
  ('pinterest', 21, 'America/Los_Angeles', 2);

-- Twitter: morning, lunch, commute
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('twitter', 8, 'America/Los_Angeles', 3),
  ('twitter', 12, 'America/Los_Angeles', 3),
  ('twitter', 17, 'America/Los_Angeles', 3);

-- Threads: mirrors Instagram with evening shift
INSERT INTO schedule_config (platform, preferred_hour, timezone, posts_per_day)
VALUES
  ('threads', 7, 'America/Los_Angeles', 3),
  ('threads', 12, 'America/Los_Angeles', 3),
  ('threads', 19, 'America/Los_Angeles', 3);
