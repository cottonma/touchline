import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Use DATABASE_URL from environment (Railway provides this automatically)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('   Set it to a PostgreSQL connection string, e.g.:');
  console.error('   DATABASE_URL=postgresql://user:pass@host:5432/dbname');
  process.exit(1);
}

// Create PostgreSQL connection
// For queries (used by drizzle-orm)
const queryClient = postgres(connectionString);

// Create Drizzle ORM instance
export const db = drizzle(queryClient);

// Export raw sql client for migrations and raw queries
export const sql = queryClient;

console.log('📦 PostgreSQL connected');
