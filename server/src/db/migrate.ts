import { connection } from './index.js';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const migrationsDir = path.join(__dirname, 'migrations');

/**
 * Run all pending database migrations in order.
 * Uses a simple migrations tracking table.
 */
function migrate(): void {
  console.log('🔄 Running database migrations...\n');

  // Create migrations tracking table
  connection.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get already applied migrations
  const applied = connection
    .prepare('SELECT name FROM _migrations ORDER BY id')
    .all() as { name: string }[];
  const appliedSet = new Set(applied.map((m) => m.name));

  // Get migration files
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('  No migration files found.\n');
    return;
  }

  let count = 0;

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    try {
      connection.exec(sql);
      connection.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      console.log(`  ✅ Applied: ${file}`);
      count++;
    } catch (error) {
      console.error(`  ❌ Failed: ${file}`);
      console.error(`     ${(error as Error).message}`);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('  All migrations already applied.\n');
  } else {
    console.log(`\n  ${count} migration(s) applied successfully.\n`);
  }
}

migrate();
process.exit(0);
