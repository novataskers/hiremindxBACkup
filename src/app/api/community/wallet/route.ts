import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { freelancerWallets, walletTransactions, notifications } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

function buildAuthHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const authz = req.headers.get("authorization");
  if (authz) h.set("authorization", authz);
  return h;
}

// GET — fetch wallet balance and transaction history
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get or create wallet
    let [wallet] = await db.select().from(freelancerWallets)
      .where(eq(freelancerWallets.userId, session.user.id));

    if (!wallet) {
      [wallet] = await db.insert(freelancerWallets).values({
        userId: session.user.id,
        availableBalance: 0,
        pendingBalance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        updatedAt: new Date().toISOString(),
      }).returning();
    }

    // Get transaction history
    const transactions = await db.select().from(walletTransactions)
      .where(eq(walletTransactions.userId, session.user.id))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(50);

    return NextResponse.json({
      wallet: {
        availableBalance: wallet.availableBalance,
        pendingBalance: wallet.pendingBalance,
        totalEarned: wallet.totalEarned,
        totalWithdrawn: wallet.totalWithdrawn,
      },
      transactions,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    return NextResponse.json({ error: "Failed to fetch wallet data" }, { status: 500 });
  }
}

// POST — withdraw funds
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount, withdrawalMethod } = body;

    if (!amount || !withdrawalMethod) {
      return NextResponse.json({ error: "Missing amount or withdrawal method" }, { status: 400 });
    }

    const amountPence = Math.round(Number(amount) * 100);
    if (amountPence <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const [wallet] = await db.select().from(freelancerWallets)
      .where(eq(freelancerWallets.userId, session.user.id));

    if (!wallet || wallet.availableBalance < amountPence) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Transaction fee is absorbed by platform (max £3, taken from platform's £10 fee)
    // Freelancer gets full amount
    const transactionFee = 0; // Fee is on platform side, not freelancer
    const netAmount = amountPence;

    // Deduct from wallet
    await db.update(freelancerWallets)
      .set({
        availableBalance: wallet.availableBalance - amountPence,
        totalWithdrawn: wallet.totalWithdrawn + amountPence,
        updatedAt: now,
      })
      .where(eq(freelancerWallets.userId, session.user.id));

    // Record withdrawal transaction
    const [transaction] = await db.insert(walletTransactions).values({
      userId: session.user.id,
      type: "withdrawal",
      amount: amountPence,
      fee: transactionFee,
      netAmount,
      description: `Withdrawal to ${withdrawalMethod.replace(/_/g, " ")}`,
      withdrawalMethod,
      status: "completed",
      createdAt: now,
    }).returning();

    // Notify
    await db.insert(notifications).values({
      userId: session.user.id,
      type: "withdrawal_completed",
      title: "Withdrawal Processed",
      message: `Your withdrawal of £${(amountPence / 100).toFixed(2)} to ${withdrawalMethod.replace(/_/g, " ")} has been processed successfully.`,
      isRead: false,
      createdAt: now,
    });

    return NextResponse.json({ success: true, transaction });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
  }
}
