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

// POST — withdraw funds via Stripe Connect Transfer
// Freelancers only need a Connect account when they want to withdraw.
// If they don't have one yet, we create it and return an onboarding link.
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

    const stripe = getStripeClient();
    const now = new Date().toISOString();

    // Check / create Stripe Connect account for this freelancer
    const [profile] = await db
      .select({ stripeAccountId: communityProfiles.stripeAccountId })
      .from(communityProfiles)
      .where(eq(communityProfiles.userId, session.user.id))
      .limit(1);

    let stripeAccountId = profile?.stripeAccountId;

    if (!stripeAccountId) {
      // Lazy-create a Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        country: "GB",
        email: session.user.email || undefined,
        capabilities: { transfers: { requested: true } },
        metadata: { userId: session.user.id },
      });

      stripeAccountId = account.id;

      await db.update(communityProfiles)
        .set({ stripeAccountId, updatedAt: now })
        .where(eq(communityProfiles.userId, session.user.id));
    }

    // Check onboarding status
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const isOnboarded = account.details_submitted && account.payouts_enabled;

    if (!isOnboarded) {
      // Return onboarding link so frontend can redirect them
      const accountLink = await stripe.accountLinks.create({
        account: stripeAccountId,
        refresh_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.hiremindx.com"}/profile?stripe_connect=refresh`,
        return_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.hiremindx.com"}/profile?stripe_connect=success`,
        type: "account_onboarding",
      });

      return NextResponse.json({
        needsOnboarding: true,
        onboardingUrl: accountLink.url,
        message: "Please complete your payout setup before withdrawing funds.",
      });
    }

    // Verify wallet balance
    const [wallet] = await db.select().from(freelancerWallets)
      .where(eq(freelancerWallets.userId, session.user.id));

    if (!wallet || wallet.availableBalance < amountPence) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Create Stripe Transfer from platform to freelancer's Connect account
    let transfer;
    try {
      transfer = await stripe.transfers.create({
        amount: amountPence,
        currency: "gbp",
        destination: stripeAccountId,
        metadata: {
          userId: session.user.id,
          type: "freelancer_withdrawal",
        },
      });
    } catch (stripeError: any) {
      console.error("[wallet/withdraw] Stripe Transfer failed:", stripeError);
      return NextResponse.json(
        { error: stripeError.message || "Failed to transfer funds. Please try again later." },
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
      stripeTransferId: transfer.id,
      description: `Withdrawal to connected account`,
      withdrawalMethod: withdrawalMethod || "stripe_connect",
      status: transfer.reversed ? "reversed" : "completed",
      createdAt: now,
    }).returning();

    // Notify
    await db.insert(notifications).values({
      userId: session.user.id,
      type: "withdrawal_completed",
      title: "Withdrawal Initiated",
      message: `Your withdrawal of £${(amountPence / 100).toFixed(2)} has been initiated. Transfer speed depends on your chosen payout method and bank.`,
      isRead: false,
      createdAt: now,
    });

    return NextResponse.json({
      success: true,
      transaction,
      transferId: transfer.id,
    });
  } catch (error) {
    console.error("Error processing withdrawal:", error);
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
  }
}
