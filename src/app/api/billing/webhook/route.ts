import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getBillingPlan } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

function toDate(unixSeconds: number | null | undefined): Date | null {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) {
    return null;
  }

  return new Date(unixSeconds * 1000);
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return secret;
}

async function findUserIdFromStripeIdentifiers({
  userId,
  customerId,
  subscriptionId,
}: {
  userId?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
}): Promise<string | null> {
  if (userId) {
    return userId;
  }

  if (subscriptionId) {
    const bySubscription = await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
      .limit(1);

    if (bySubscription[0]?.userId) {
      return bySubscription[0].userId;
    }
  }

  if (customerId) {
    const byCustomer = await db
      .select({ userId: subscriptions.userId })
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);

    if (byCustomer[0]?.userId) {
      return byCustomer[0].userId;
    }
  }

  return null;
}

async function persistSubscription({
  userId,
  planId,
  status,
  currency,
  amount,
  interval,
  stripeCustomerId,
  stripeSubscriptionId,
  stripeCheckoutSessionId,
  currentPeriodStart,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  metadata,
}: {
  userId: string;
  planId: string;
  status: string;
  currency: string;
  amount: number;
  interval: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeCheckoutSessionId: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await db
    .insert(subscriptions)
    .values({
      userId,
      planId,
      status,
      currency,
      amount,
      interval,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeCheckoutSessionId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      metadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        planId,
        status,
        currency,
        amount,
        interval,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeCheckoutSessionId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        metadata,
        updatedAt: new Date(),
      },
    });
}

async function syncStripeSubscription({
  userId,
  stripeSubscription,
  stripeCheckoutSessionId,
}: {
  userId: string;
  stripeSubscription: Stripe.Subscription;
  stripeCheckoutSessionId?: string | null;
}): Promise<void> {
  const planId = stripeSubscription.metadata?.planId;
  const plan = getBillingPlan(planId) ?? null;
  const price = stripeSubscription.items.data[0]?.price ?? null;

  await persistSubscription({
    userId,
    planId: plan?.id ?? planId ?? "basic",
    status: stripeSubscription.status,
    currency: (price?.currency ?? plan?.currency ?? "GBP").toUpperCase(),
    amount:
      typeof price?.unit_amount === "number" && Number.isFinite(price.unit_amount)
        ? price.unit_amount
        : plan?.amountPence ?? 0,
    interval: price?.recurring?.interval ?? plan?.interval ?? "month",
    stripeCustomerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
    stripeSubscriptionId: stripeSubscription.id,
    stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
    currentPeriodStart: toDate(stripeSubscription.current_period_start),
    currentPeriodEnd: toDate(stripeSubscription.current_period_end),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    metadata: {
      stripeCustomerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
      planId: plan?.id ?? planId ?? null,
      status: stripeSubscription.status,
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return jsonError("Missing Stripe signature.", 400);
    }

    const secret = getWebhookSecret();
    const payload = await request.text();

    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload.";
    console.error("[stripe-webhook] verification failed:", error);
    return jsonError(message, 400);
  }

  try {
    const stripe = getStripeClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== "subscription") {
          break;
        }

        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        const userId = await findUserIdFromStripeIdentifiers({
          userId: session.client_reference_id ?? session.metadata?.userId ?? null,
          customerId,
          subscriptionId,
        });

        if (!userId || !subscriptionId) {
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncStripeSubscription({
          userId,
          stripeSubscription,
          stripeCheckoutSessionId: session.id,
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const userId = await findUserIdFromStripeIdentifiers({
          userId: stripeSubscription.metadata?.userId ?? null,
          customerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
          subscriptionId: stripeSubscription.id,
        });

        if (!userId) {
          break;
        }

        await syncStripeSubscription({
          userId,
          stripeSubscription,
          stripeCheckoutSessionId: stripeSubscription.metadata?.checkoutSessionId ?? null,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const userId = await findUserIdFromStripeIdentifiers({
          userId: stripeSubscription.metadata?.userId ?? null,
          customerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
          subscriptionId: stripeSubscription.id,
        });

        if (!userId) {
          break;
        }

        const planId = stripeSubscription.metadata?.planId;
        const plan = getBillingPlan(planId) ?? null;
        const price = stripeSubscription.items.data[0]?.price ?? null;

        await persistSubscription({
          userId,
          planId: plan?.id ?? planId ?? "basic",
          status: "canceled",
          currency: (price?.currency ?? plan?.currency ?? "GBP").toUpperCase(),
          amount:
            typeof price?.unit_amount === "number" && Number.isFinite(price.unit_amount)
              ? price.unit_amount
              : plan?.amountPence ?? 0,
          interval: price?.recurring?.interval ?? plan?.interval ?? "month",
          stripeCustomerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCheckoutSessionId: stripeSubscription.metadata?.checkoutSessionId ?? null,
          currentPeriodStart: toDate(stripeSubscription.current_period_start),
          currentPeriodEnd: toDate(stripeSubscription.current_period_end ?? stripeSubscription.canceled_at),
          cancelAtPeriodEnd: false,
          metadata: {
            stripeCustomerId: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : null,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCheckoutSessionId: stripeSubscription.metadata?.checkoutSessionId ?? null,
            planId: plan?.id ?? planId ?? null,
            status: "canceled",
          },
        });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error("[stripe-webhook] processing failed:", error);
    return jsonError("Webhook processing failed.", 500);
  }

  return NextResponse.json({ received: true });
}
