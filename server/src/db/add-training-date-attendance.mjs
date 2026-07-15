/**
 * Migration: Add date column to training_sessions and session_id column to training_attendance.
 * Also makes fixture_id nullable on training_attendance for session-based attendance.
 * Run with: node server/src/db/add-training-date-attendance.mjs
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../touchline.db');
const db = new Database(DB_PATH);

// Add date column to training_sessions
try {
  db.exec(`ALTER TABLE training_sessions ADD COLUMN date TEXT`);
  console.log('✅ Added date column to training_sessions.');
} catch (err) {
  if (err.message.includes('duplicate column') || err.message.includes('already exists')) {
    console.log('ℹ️  Column date already exists on training_sessions, skipping.');
  } else {
    throw err;
  }
}

// Recreate training_attendance to make fixture_id nullable and add session_id
try {
  // Check if session_id already exists
  const tableInfo = db.pragma('table_info(training_attendance)');
  const hasSessionId = tableInfo.some((col) => col.name === 'session_id');

  if (!hasSessionId) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS training_attendance_new (
        id TEXT PRIMARY KEY,
        fixture_id TEXT REFERENCES fixtures(id),
        session_id TEXT REFERENCES training_sessions(id),
        player_id TEXT NOT NULL REFERENCES players(id),
        attended INTEGER NOT NULL DEFAULT 0,
        reason TEXT
      )
    `);

    // Copy existing data
    db.exec(`
      INSERT INTO training_attendance_new (id, fixture_id, session_id, player_id, attended, reason)
      SELECT id, fixture_id, NULL, player_id, attended, reason FROM training_attendance
    `);

    // Drop old table and rename
    db.exec(`DROP TABLE training_attendance`);
    db.exec(`ALTER TABLE training_attendance_new RENAME TO training_attendance`);

    console.log('✅ Recreated training_attendance with session_id column and nullable fixture_id.');
  } else {
    console.log('ℹ️  Column session_id already exists on training_attendance, skipping.');
  }
} catch (err) {
  console.error('Error migrating training_attendance:', err.message);
  throw err;
}

db.close();
console.log('✅ Migration complete.');
