import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getBillingPlan, getPlanPriceGbp, isActiveSubscriptionStatus } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function serializeTimestamp(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401);
  }

  const subscriptionRows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, session.user.id))
    .limit(1);

  let subscription = subscriptionRows[0] ?? null;

  // Proactively check Stripe if the status is pending (e.g. just returned from checkout but webhook hasn't fired)
  if (subscription && subscription.status === "pending" && subscription.stripeCheckoutSessionId) {
    try {
      const { getStripeClient } = await import("@/lib/stripe");
      const stripe = getStripeClient();
      const checkoutSession = await stripe.checkout.sessions.retrieve(subscription.stripeCheckoutSessionId);
      
      if (checkoutSession.status === "complete" && checkoutSession.subscription) {
        const stripeSubscriptionId = typeof checkoutSession.subscription === "string" 
          ? checkoutSession.subscription 
          : checkoutSession.subscription.id;
          
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        
        const periodStart = new Date(stripeSub.current_period_start * 1000);
        const periodEnd = new Date(stripeSub.current_period_end * 1000);

        // Update DB
        await db.update(subscriptions)
          .set({
            status: stripeSub.status,
            stripeSubscriptionId: stripeSubscriptionId,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            updatedAt: new Date()
          })
          .where(eq(subscriptions.userId, session.user.id));
          
        // Update local object for response
        subscription.status = stripeSub.status;
        subscription.stripeSubscriptionId = stripeSubscriptionId;
        subscription.currentPeriodStart = periodStart;
        subscription.currentPeriodEnd = periodEnd;
        subscription.cancelAtPeriodEnd = stripeSub.cancel_at_period_end;
      }
    } catch (e) {
      console.error("[billing-sync] Proactive stripe fetch failed", e);
    }
  }

  const plan = subscription ? getBillingPlan(subscription.planId) : null;

  return NextResponse.json({
    subscription: subscription
      ? {
          planId: subscription.planId,
          status: subscription.status,
          currency: subscription.currency,
          amount: subscription.amount,
          interval: subscription.interval,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          currentPeriodStart: serializeTimestamp(subscription.currentPeriodStart),
          currentPeriodEnd: serializeTimestamp(subscription.currentPeriodEnd),
          createdAt: serializeTimestamp(subscription.createdAt),
        }
      : null,
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          price: getPlanPriceGbp(plan),
          currency: plan.currency,
          interval: plan.interval,
        }
      : null,
    isActive: subscription ? isActiveSubscriptionStatus(subscription.status) : false,
  });
}
