
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const client = createClient({
    url: process.env.TURSO_CONNECTION_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  try {
    const rs = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("Tables:", rs.rows);
  } catch (e) {
    console.error("Failed to connect or query:", e);
  }
}

main();
