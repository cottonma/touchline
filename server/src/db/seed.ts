/**
 * Database seeder - populates development goal library
 * Run with: npm run db:seed
 */

import { sql } from './index.js';

console.log('🌱 Seeding database...\n');

// This will be populated when we build the Player Development feature
console.log('  ℹ️  Seed data will be added as features are built.\n');

await sql.end();
process.exit(0);
