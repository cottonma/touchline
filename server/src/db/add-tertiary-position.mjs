/**
 * Migration: Add tertiary_position column to players table.
 * Run with: node server/src/db/add-tertiary-position.mjs
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../touchline.db');
const db = new Database(DB_PATH);

try {
  db.exec(`ALTER TABLE players ADD COLUMN tertiary_position TEXT`);
  console.log('✅ Added tertiary_position column to players table.');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️  Column tertiary_position already exists, skipping.');
  } else {
    throw err;
  }
}

db.close();
