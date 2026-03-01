-- Initial schema for Words Left Unsaid
-- Recreates the original messages table with RLS policies

CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  "from" TEXT NOT NULL CHECK (char_length("from") <= 25),
  "to" TEXT NOT NULL CHECK (char_length("to") <= 25),
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  email TEXT CHECK (email IS NULL OR char_length(email) <= 30),
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved messages
CREATE POLICY "Public can read approved messages"
  ON messages FOR SELECT
  USING (approved = true);

-- Anyone can insert messages (they start as unapproved)
CREATE POLICY "Anyone can submit messages"
  ON messages FOR INSERT
  WITH CHECK (approved = false);

-- Only service role can update (approve/reject)
CREATE POLICY "Service role can update messages"
  ON messages FOR UPDATE
  USING (auth.role() = 'service_role');

-- Only service role can delete
CREATE POLICY "Service role can delete messages"
  ON messages FOR DELETE
  USING (auth.role() = 'service_role');
