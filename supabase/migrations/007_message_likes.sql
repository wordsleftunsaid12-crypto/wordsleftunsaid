-- Add like_count column to messages (maintained by trigger)
ALTER TABLE messages ADD COLUMN like_count INTEGER DEFAULT 0 NOT NULL;

-- Create message_likes table for dedup tracking
CREATE TABLE message_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL CHECK (char_length(visitor_id) <= 50),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, visitor_id)
);

CREATE INDEX idx_message_likes_message_id ON message_likes(message_id);
CREATE INDEX idx_message_likes_visitor ON message_likes(message_id, visitor_id);

-- Trigger to maintain like_count on messages
-- SECURITY DEFINER so anon inserts can update messages.like_count
CREATE OR REPLACE FUNCTION update_message_like_count()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE messages SET like_count = like_count + 1 WHERE id = NEW.message_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE messages SET like_count = like_count - 1 WHERE id = OLD.message_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_message_like_count
AFTER INSERT OR DELETE ON message_likes
FOR EACH ROW EXECUTE FUNCTION update_message_like_count();

-- RLS
ALTER TABLE message_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON message_likes FOR SELECT USING (true);

CREATE POLICY "Anyone can like a message"
  ON message_likes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can unlike"
  ON message_likes FOR DELETE USING (true);
