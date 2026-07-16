-- Add club_id column to players table for team filtering
ALTER TABLE players ADD COLUMN IF NOT EXISTS club_id TEXT REFERENCES clubs(id);
