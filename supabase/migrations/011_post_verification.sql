-- Add verification columns to posts table for post-publish QA.
-- verified: NULL = unchecked, true = confirmed live, false = not found
ALTER TABLE posts ADD COLUMN verified BOOLEAN DEFAULT NULL;
ALTER TABLE posts ADD COLUMN verified_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN verification_error TEXT;
ALTER TABLE posts ADD COLUMN platform_post_url TEXT;
