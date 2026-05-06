import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { subscriptions, user } from "@/db/schema";
import { getBillingPlan, isActiveSubscriptionStatus } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { sendHireMindXEmailNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function sendCancellationEmail(params: {
  userId: string;
  planName: string;
  isRefunded: boolean;
  amountPence: number;
  currency: string;
  endDate: Date | string | null;
}) {
  try {
    const userRows = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, params.userId)).limit(1);
    const u = userRows[0];
    if (!u?.email) return;

    const price = (params.amountPence / 100).toFixed(2);
    const dateStr = params.endDate
      ? new Date(params.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "soon";

    if (params.isRefunded) {
      await sendHireMindXEmailNotification({
        to: u.email,
        subject: "Your HireMindX subscription has been canceled — Refund processing",
        variant: "subscription_canceled",
        title: "Subscription Canceled",
        summary: `Your ${params.planName} Plan has been canceled. Since you are within the 14-day money-back guarantee period, a full refund of ${params.currency} ${price} has been initiated. The funds will be returned to your account within 48 hours.`,
        previewText: "Your subscription has been canceled and a refund is being processed.",
        recipientName: u.name || "there",
        metadata: [
          { label: "Plan", value: params.planName },
          { label: "Refund", value: `${params.currency} ${price} within 48 hours` },
        ],
      });
    } else {
      await sendHireMindXEmailNotification({
        to: u.email,
        subject: "Your HireMindX subscription has been canceled",
        variant: "subscription_canceled",
        title: "Subscription Canceled",
        summary: `Your ${params.planName} Plan has been canceled. You will continue to have access to all premium features until ${dateStr}. After that date, your account will revert to the Free plan.`,
        previewText: `Your subscription is active until ${dateStr}.`,
        recipientName: u.name || "there",
        metadata: [
          { label: "Plan", value: params.planName },
          { label: "Active Until", value: dateStr },
        ],
      });
    }
  } catch (e) {
    console.error("[billing/cancel] Failed to send cancellation email:", e);
  }
}

// POST /api/billing/cancel — Cancel the user's active subscription
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return jsonError("Unauthorized", 401);
    }

    const subscriptionRows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, session.user.id))
      .limit(1);

    const subscription = subscriptionRows[0] ?? null;

    if (!subscription) {
      return jsonError("No subscription found.", 404);
    }

    if (!isActiveSubscriptionStatus(subscription.status)) {
      return jsonError("Your subscription is not currently active.", 400);
    }

    if (!subscription.stripeSubscriptionId) {
      return jsonError("No Stripe subscription found to cancel.", 400);
    }

    const stripe = getStripeClient();

    const createdDate = new Date(subscription.createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - createdDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isEligibleForRefund = diffDays <= 14;

    if (isEligibleForRefund) {
      // Cancel immediately
      const stripeSub = await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      
      // Issue refund for the latest invoice
      if (stripeSub.latest_invoice) {
        const latestInvoiceId = typeof stripeSub.latest_invoice === "string" ? stripeSub.latest_invoice : stripeSub.latest_invoice.id;
        const invoice = await stripe.invoices.retrieve(latestInvoiceId);
        
        const invAny = invoice as any;
        if (invAny.payment_intent) {
          const paymentIntentId = typeof invAny.payment_intent === "string" ? invAny.payment_intent : invAny.payment_intent.id;
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
          });
        }
      }

      // Update local DB
      await db
        .update(subscriptions)
        .set({
          status: "canceled",
          cancelAtPeriodEnd: false,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, session.user.id));

      const plan = getBillingPlan(subscription.planId);
      await sendCancellationEmail({
        userId: session.user.id,
        planName: plan?.name ?? "Premium",
        isRefunded: true,
        amountPence: subscription.amount,
        currency: subscription.currency ?? "GBP",
        endDate: null,
      });

      return NextResponse.json({
        success: true,
        message: "Your subscription has been canceled and a refund has been issued. Funds will be returned to your account in 48 hours.",
        cancelAtPeriodEnd: false,
        status: "canceled",
      });
    } else {
      // Cancel at period end (graceful cancellation)
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update local DB
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, session.user.id));

      const plan = getBillingPlan(subscription.planId);
      await sendCancellationEmail({
        userId: session.user.id,
        planName: plan?.name ?? "Premium",
        isRefunded: false,
        amountPence: subscription.amount,
        currency: subscription.currency ?? "GBP",
        endDate: subscription.currentPeriodEnd,
      });

      return NextResponse.json({
        success: true,
        message: "Your subscription will be canceled at the end of the current billing period.",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: subscription.currentPeriodEnd,
      });
    }
  } catch (error) {
    console.error("[billing/cancel] Error:", error);
    const message = error instanceof Error ? error.message : "Unable to cancel subscription.";
    return jsonError(message, 500);
  }
}
