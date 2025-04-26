import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';



// Use drizzle's built-in connection handling

const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  },
  schema,
});

console.log('Database connection established');

export { db };
