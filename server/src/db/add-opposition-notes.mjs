/**
 * Migration: Add opposition_notes table.
 * Run with: node server/src/db/add-opposition-notes.mjs
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../touchline.db');
const db = new Database(DB_PATH);

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS opposition_notes (
      id TEXT PRIMARY KEY,
      opponent TEXT NOT NULL,
      fixture_id TEXT REFERENCES fixtures(id),
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  console.log('✅ Created opposition_notes table.');
} catch (err) {
  if (err.message.includes('already exists')) {
    console.log('ℹ️  Table opposition_notes already exists, skipping.');
  } else {
    throw err;
  }
}

db.close();
