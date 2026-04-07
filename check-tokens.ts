
import { db } from "./src/db";
import { account } from "./src/db/schema";
import { eq } from "drizzle-orm";

async function checkTokens() {
  const accounts = await db.select().from(account).where(eq(account.providerId, "google"));
  console.log(`Found ${accounts.length} Google accounts.`);
  accounts.forEach(acc => {
    console.log(`User: ${acc.userId}, Has Access Token: ${!!acc.accessToken}, Has Refresh Token: ${!!acc.refreshToken}, Expiry: ${acc.accessTokenExpiresAt}`);
  });
  process.exit(0);
}

checkTokens().catch(err => {
  console.error(err);
  process.exit(1);
});
