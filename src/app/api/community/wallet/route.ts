import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { freelancerWallets, walletTransactions, notifications, communityProfiles } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe";

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

// POST — withdraw funds via Stripe Connect Payout
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount, withdrawalMethod } = body;

    if (!amount) {
      return NextResponse.json({ error: "Missing amount" }, { status: 400 });
    }

    const amountPence = Math.round(Number(amount) * 100);
    if (amountPence <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Verify freelancer has a Stripe Connect account
    const [profile] = await db
      .select({ stripeAccountId: communityProfiles.stripeAccountId })
      .from(communityProfiles)
      .where(eq(communityProfiles.userId, session.user.id))
      .limit(1);

    if (!profile?.stripeAccountId) {
      return NextResponse.json(
        { error: "You must complete Stripe Connect onboarding before withdrawing funds." },
        { status: 400 }
      );
    }

    const [wallet] = await db.select().from(freelancerWallets)
      .where(eq(freelancerWallets.userId, session.user.id));

    if (!wallet || wallet.availableBalance < amountPence) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const stripe = getStripeClient();

    // Create Stripe Connect Payout to freelancer's bank
    let payout;
    try {
      payout = await stripe.payouts.create(
        {
          amount: amountPence,
          currency: "gbp",
          metadata: {
            userId: session.user.id,
            type: "freelancer_withdrawal",
          },
        },
        { stripeAccount: profile.stripeAccountId }
      );
    } catch (stripeError: any) {
      console.error("[wallet/withdraw] Stripe Payout failed:", stripeError);
      return NextResponse.json(
        { error: stripeError.message || "Failed to create payout. Ensure your Connect account is fully verified and has sufficient balance." },
        { status: 400 }
      );
    }

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
      fee: 0,
      netAmount: amountPence,
      stripePayoutId: payout.id,
      description: `Withdrawal to bank account`,
      withdrawalMethod: withdrawalMethod || "stripe_connect",
      status: payout.status === "paid" ? "completed" : "pending",
      createdAt: now,
    }).returning();

    // Notify
    await db.insert(notifications).values({
      userId: session.user.id,
      type: "withdrawal_completed",
      title: "Withdrawal Initiated",
      message: `Your withdrawal of £${(amountPence / 100).toFixed(2)} has been initiated. Funds will arrive in your bank account within 1-2 business days.`,
      isRead: false,
      createdAt: now,
    });

    return NextResponse.json({ success: true, transaction, payoutId: payout.id, status: payout.status });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
  }
}
