-- Social media engine tables
-- Supports: content queue, posting, engagement tracking, analytics, and strategy learning

-- Content queue: tracks videos from content-engine through the posting pipeline
CREATE TABLE content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_path TEXT NOT NULL,
  message_ids UUID[] NOT NULL DEFAULT '{}',
  template TEXT NOT NULL,
  mood TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'captioned', 'scheduled', 'posted', 'failed')),
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  scheduled_for TIMESTAMPTZ,
  platform TEXT NOT NULL DEFAULT 'instagram'
    CHECK (platform IN ('instagram', 'tiktok')),
  is_exploration BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Posts: published social media content
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  platform_post_id TEXT,
  platform_media_url TEXT,
  content_queue_id UUID REFERENCES content_queue(id),
  message_ids UUID[] NOT NULL DEFAULT '{}',
  caption TEXT,
  hashtags TEXT[] DEFAULT '{}',
  template TEXT,
  mood TEXT,
  post_type TEXT NOT NULL DEFAULT 'reel'
    CHECK (post_type IN ('reel', 'feed', 'carousel', 'story')),
  is_exploration BOOLEAN DEFAULT false,
  posted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Engagement metrics: periodic snapshots of post performance
CREATE TABLE engagement_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) NOT NULL,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  measured_at TIMESTAMPTZ DEFAULT now()
);

-- Comment tracking: comments on our posts + AI replies
CREATE TABLE comment_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) NOT NULL,
  platform_comment_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  replied BOOLEAN DEFAULT false,
  reply_text TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Schedule configuration: posting preferences per platform
CREATE TABLE schedule_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  preferred_hour INTEGER CHECK (preferred_hour BETWEEN 0 AND 23),
  timezone TEXT DEFAULT 'America/New_York',
  posts_per_day INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Outbound engagement: tracks Playwright-based likes, follows, comments
CREATE TABLE outbound_engagement (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'follow', 'comment')),
  target_username TEXT NOT NULL,
  target_post_url TEXT,
  target_hashtag TEXT,
  comment_text TEXT,
  resulted_in_followback BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Strategy briefs: AI-generated content strategy from performance analysis
CREATE TABLE strategy_briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brief JSONB NOT NULL,
  based_on_posts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Follower snapshots: daily follower count for growth tracking
CREATE TABLE follower_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok')),
  follower_count INTEGER NOT NULL,
  following_count INTEGER NOT NULL DEFAULT 0,
  measured_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_content_queue_status ON content_queue(status);
CREATE INDEX idx_content_queue_scheduled ON content_queue(scheduled_for)
  WHERE status = 'scheduled';
CREATE INDEX idx_posts_platform ON posts(platform, posted_at DESC);
CREATE INDEX idx_posts_content_queue ON posts(content_queue_id);
CREATE INDEX idx_engagement_metrics_post ON engagement_metrics(post_id, measured_at DESC);
CREATE INDEX idx_comment_tracking_unreplied ON comment_tracking(post_id)
  WHERE replied = false;
CREATE INDEX idx_outbound_engagement_date ON outbound_engagement(created_at DESC);
CREATE INDEX idx_outbound_engagement_action ON outbound_engagement(action_type, created_at);
CREATE INDEX idx_follower_snapshots_date ON follower_snapshots(platform, measured_at DESC);
CREATE INDEX idx_strategy_briefs_date ON strategy_briefs(created_at DESC);

-- RLS: service role only for all social tables
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_engagement ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategy_briefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON content_queue
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON posts
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON engagement_metrics
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON comment_tracking
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON schedule_config
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON outbound_engagement
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON strategy_briefs
  USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON follower_snapshots
  USING (auth.role() = 'service_role');
