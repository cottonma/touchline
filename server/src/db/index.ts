import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file location
// On Railway (or when RAILWAY_VOLUME_MOUNT_PATH is set), use the persistent volume
// Locally, use the server root
const DB_PATH = process.env.DATABASE_URL 
  || (process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'touchline.db') : path.join(__dirname, '../../touchline.db'));

// Create SQLite connection
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Create Drizzle ORM instance
export const db = drizzle(sqlite);

// Export raw connection for migrations
export const connection = sqlite;

console.log(`📦 Database connected: ${DB_PATH}`);
