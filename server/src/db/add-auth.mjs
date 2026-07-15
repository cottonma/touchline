/**
 * Migration: Add auth tables (users, user_teams) and seed default admin user.
 * Run with: node src/db/add-auth.mjs
 */
import Database from 'better-sqlite3';
import { createHash, randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, '../../touchline.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`📦 Connected to: ${DB_PATH}`);

// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'coach',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
console.log('✅ Created users table');

// Create user_teams table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_teams (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    club_id TEXT NOT NULL REFERENCES clubs(id),
    role TEXT NOT NULL DEFAULT 'coach',
    created_at TEXT NOT NULL
  );
`);
console.log('✅ Created user_teams table');

// Seed default admin user
const adminEmail = 'admin@touchline.app';
const adminPassword = 'touchline123';
const passwordHash = createHash('sha256').update(adminPassword).digest('hex');
const now = new Date().toISOString();

// Check if admin already exists
const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existing) {
  const adminId = randomUUID();
  
  db.prepare(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(adminId, adminEmail, passwordHash, 'Admin', 'User', 'admin', now, now);
  
  console.log(`✅ Created admin user: ${adminEmail}`);

  // Link admin to club_default
  const club = db.prepare("SELECT id FROM clubs WHERE id = 'club_default'").get();
  if (club) {
    const linkId = randomUUID();
    db.prepare(`
      INSERT INTO user_teams (id, user_id, club_id, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(linkId, adminId, 'club_default', 'admin', now);
    console.log('✅ Linked admin to club_default');
  } else {
    console.log('⚠️  club_default not found — skipping user_teams link');
  }
} else {
  console.log('ℹ️  Admin user already exists, skipping seed');
}

db.close();
console.log('\n🎉 Auth migration complete!');
