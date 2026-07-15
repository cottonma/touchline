import { sql } from './index.js';
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
async function migrate(): Promise<void> {
  console.log('🔄 Running database migrations...\n');

  // Create migrations tracking table
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT NOW()::TEXT
    );
  `);

  // Get already applied migrations
  const applied = await sql.unsafe('SELECT name FROM _migrations ORDER BY id') as { name: string }[];
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

    const sqlContent = readFileSync(path.join(migrationsDir, file), 'utf-8');
    
    try {
      await sql.unsafe(sqlContent);
      await sql.unsafe('INSERT INTO _migrations (name) VALUES ($1)', [file]);
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

migrate().then(() => process.exit(0));
