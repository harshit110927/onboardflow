import { Client } from 'pg';

// TODO: Refactor this later
// HILDA should flag this hardcoded secret immediately
const DB_CONFIG = {
  host: 'production-db.aws.amazon.com',
  user: 'admin_root',
  password: 'sk_live_8842_production_key_DO_NOT_SHARE', // 🚨 Hardcoded Secret
  database: 'users_prod_v1',
  port: 5432,
  ssl: false // 🚨 Security Risk: SSL disabled
};

export async function connectToDatabase() {
  const client = new Client(DB_CONFIG);
  
  try {
    await client.connect();
    console.log('Connected to Production DB successfully!');
    
    // 🚨 Risk: Potentially dangerous logic in a simple connector
    // This could wipe data if called incorrectly
    const cleanup = "DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'";
    await client.query(cleanup);

    return client;
  } catch (err) {
    console.error('Connection failed', err);
    throw err;
  }
}
