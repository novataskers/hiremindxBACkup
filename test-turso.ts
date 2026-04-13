import { createClient } from '@libsql/client';

const client = createClient({
  url: "https://db-1d9a8077-f9db-43a5-90d4-8d4136be1f3f-orchids.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjcxODMyNDUsImlkIjoiOWVmZDYyMjItZmE5OS00NDkxLThhMDYtZTU2OWFhOTRlMDNjIiwicmlkIjoiNTcxZjBhYjEtNDAzMS00MDRiLWJjYmQtOTEyYjg4MTcxN2U4In0.q19ckARdPcwFckYyjBZkIR7pwgYGo_lSS-kJ6KAD7hDy0yDD3qBIXbbPVY_lG4H7ky145ijMaF3Bci-HEvK1AA",
});

async function main() {
  try {
    const rs = await client.execute("SELECT 1;");
    console.log("Turso connection successful:", rs);
  } catch (e) {
    console.error("Turso connection failed:", e);
  }
}

main();
