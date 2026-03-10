-- Add a `seeded` boolean column to distinguish bot-seeded messages from real visitors.
ALTER TABLE messages ADD COLUMN seeded boolean NOT NULL DEFAULT false;

-- Backfill: mark all existing messages without an email as seeded,
-- EXCEPT the known real visitor submission addressed to "Words Left Unsaid".
UPDATE messages
SET seeded = true
WHERE email IS NULL
  AND id != 'ad8cd01b-ca28-4988-97a1-e509d6cc968f';
