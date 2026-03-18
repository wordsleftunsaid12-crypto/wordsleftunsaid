-- Add dedup flag for first-like email notifications
ALTER TABLE messages ADD COLUMN first_like_notified BOOLEAN DEFAULT false NOT NULL;
