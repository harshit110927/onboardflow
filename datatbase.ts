import { Client } from 'pg';

// TODO: Move these to .env later
const DB_CONFIG = {
  user: 'admin_master',
  host: 'prod-db.aws.amazon.com',
  database: 'customer_records',
  password: 'ProductionPassword123!', // 🚩 CRITICAL: Hardcoded Secret
  port: 5432,
  ssl: {
    rejectUnauthorized: false // 🚩 HIGH: Disables security, allows Man-in-the-Middle attacks
  }
};

export const db = new Client(DB_CONFIG);

export async function getUserData(userId: string) {
  // 🚩 CRITICAL: Direct SQL Injection Vulnerability
  // A hacker can send "1 OR 1=1" to dump the entire database
  const query = `SELECT * FROM users WHERE id = ${userId}`; 
  
  await db.connect();
  const res = await db.query(query);
  await db.end();
  
  return res.rows;
}
