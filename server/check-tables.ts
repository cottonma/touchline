import { sql } from './src/db/index.js';
const r = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'match_plan%'`;
console.log('Match plan tables:', r);
process.exit(0);
