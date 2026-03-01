-- Add 'qa_passed' status to content_queue pipeline
-- New flow: pending → qa_passed → captioned → scheduled → posted

ALTER TABLE content_queue DROP CONSTRAINT content_queue_status_check;
ALTER TABLE content_queue ADD CONSTRAINT content_queue_status_check
  CHECK (status IN ('pending', 'qa_passed', 'captioned', 'scheduled', 'posted', 'failed'));
