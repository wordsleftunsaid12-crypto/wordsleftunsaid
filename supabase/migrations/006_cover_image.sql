-- Add cover_image_path column to content_queue table
-- Stores the path to a PNG thumbnail (frame 0) generated alongside each video
ALTER TABLE content_queue ADD COLUMN cover_image_path TEXT;
