import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// SINGLETON PATTERN: This prevents multiple connections in development
// It saves the connection to a "global" variable so it survives hot-reloads.
let client;

if (process.env.NODE_ENV === 'production') {
  client = postgres(connectionString);
} else {
  if (!(global as any).postgresClient) {
    (global as any).postgresClient = postgres(connectionString);
  }
  client = (global as any).postgresClient;
}

export const db = drizzle(client, { schema });