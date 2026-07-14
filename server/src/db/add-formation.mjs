/**
 * Migration: Add formation column to seasons table.
 * Run with: node server/src/db/add-formation.mjs
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../touchline.db');
const db = new Database(DB_PATH);

try {
  db.exec(`ALTER TABLE seasons ADD COLUMN formation TEXT`);
  console.log('✅ Added formation column to seasons table.');
} catch (err) {
  if (err.message.includes('duplicate column name')) {
    console.log('ℹ️  Column formation already exists, skipping.');
  } else {
    throw err;
  }
}

db.close();
