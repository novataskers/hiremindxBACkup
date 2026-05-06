import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@libsql/client";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-migrate-secret");
  if (secret !== "hiremindx-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = process.env.TURSO_CONNECTION_URL || "";
  const url = rawUrl.replace(/^libsql:\/\//, "https://");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || "",
  });

  const statements = [
    `ALTER TABLE community_profiles ADD COLUMN stripe_account_id TEXT;`,
    `ALTER TABLE wallet_transactions ADD COLUMN stripe_transfer_id TEXT;`,
    `ALTER TABLE escrow_transactions ADD COLUMN stripe_transfer_id TEXT;`,
  ];

  const results: string[] = [];
  for (const sql of statements) {
    try {
      await client.execute(sql);
      results.push(`Applied: ${sql}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column") || e.message?.includes("already exists") || e.message?.includes("already has column")) {
        results.push(`Already exists: ${sql}`);
      } else {
        results.push(`Failed: ${sql} — ${e.message}`);
      }
    }
  }

  return NextResponse.json({ results });
}
