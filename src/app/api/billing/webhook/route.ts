import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions, user } from "@/db/schema";
import { getBillingPlan } from "@/lib/billing";
import { getStripeClient } from "@/lib/stripe";
import { sendHireMindXEmailNotification } from "@/lib/email";

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

/** Extract current_period_start from a Stripe Subscription (SDK v19+ moved these to items.data[0]) */
function getSubscriptionPeriodStart(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  if (item && typeof (item as any).current_period_start === "number") {
    return (item as any).current_period_start;
  }
  // Fallback for older SDK or edge case
  if (typeof (sub as any).current_period_start === "number") {
    return (sub as any).current_period_start;
  }
  return null;
}

/** Extract current_period_end from a Stripe Subscription (SDK v19+ moved these to items.data[0]) */
function getSubscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  if (item && typeof (item as any).current_period_end === "number") {
    return (item as any).current_period_end;
  }
  // Fallback for older SDK or edge case
  if (typeof (sub as any).current_period_end === "number") {
    return (sub as any).current_period_end;
  }
  return null;
}

async function sendSubscriptionActivatedEmail(userId: string, planName: string, renewalDate: string | null) {
  try {
    const userRows = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
    const u = userRows[0];
    if (!u?.email) return;

    const dateStr = renewalDate
      ? new Date(renewalDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "your next billing cycle";

    await sendHireMindXEmailNotification({
      to: u.email,
      subject: `Your ${planName} Plan is now active — Welcome to HireMindX Premium`,
      variant: "subscription_activated",
      title: `${planName} Plan Activated`,
      summary: `Welcome to HireMindX Premium! Your ${planName} Plan has been successfully activated. You now have access to all the features included in your plan. Your subscription renews on ${dateStr}.`,
      previewText: `Your ${planName} Plan is now active. Explore your premium features.`,
      recipientName: u.name || "there",
      ctaLabel: "Explore Premium",
      ctaUrl: "/premium",
      metadata: [
        { label: "Plan", value: planName },
        { label: "Renews On", value: dateStr },
      ],
    });
  } catch (e) {
    console.error("[stripe-webhook] Failed to send activation email:", e);
  }
}

async function sendSubscriptionCanceledEmail(userId: string, planName: string, isRefunded: boolean, endDate: string | null) {
  try {
    const userRows = await db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
    const u = userRows[0];
    if (!u?.email) return;

    const dateStr = endDate
      ? new Date(endDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "soon";

    if (isRefunded) {
      await sendHireMindXEmailNotification({
        to: u.email,
        subject: "Your HireMindX subscription has been canceled — Refund processing",
        variant: "subscription_canceled",
        title: "Subscription Canceled",
        summary: `Your ${planName} Plan has been canceled. Since you are within the 14-day money-back guarantee period, a full refund of GBP ${planName} has been initiated. The funds will be returned to your account within 48 hours.`,
        previewText: "Your subscription has been canceled and a refund is being processed.",
        recipientName: u.name || "there",
        metadata: [
          { label: "Plan", value: planName },
          { label: "Refund", value: "Full refund within 48 hours" },
        ],
      });
    } else {
      await sendHireMindXEmailNotification({
        to: u.email,
        subject: "Your HireMindX subscription has been canceled",
        variant: "subscription_canceled",
        title: "Subscription Canceled",
        summary: `Your ${planName} Plan has been canceled. You will continue to have access to all premium features until ${dateStr}. After that date, your account will revert to the Free plan.`,
        previewText: `Your subscription is active until ${dateStr}.`,
        recipientName: u.name || "there",
        metadata: [
          { label: "Plan", value: planName },
          { label: "Active Until", value: dateStr },
        ],
      });
    }
  } catch (e) {
    console.error("[stripe-webhook] Failed to send cancellation email:", e);
  }
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
  stripeCheckoutSessionId?: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  metadata: Record<string, unknown>;
}): Promise<void> {
  // Build update set — only overwrite stripeCheckoutSessionId when we have a real value
  // (prevents customer.subscription.updated from erasing the checkout session ID)
  const updateSet: Record<string, unknown> = {
    planId,
    status,
    currency,
    amount,
    interval,
    stripeCustomerId,
    stripeSubscriptionId,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    metadata,
    updatedAt: new Date(),
  };

  if (stripeCheckoutSessionId !== undefined && stripeCheckoutSessionId !== null) {
    updateSet.stripeCheckoutSessionId = stripeCheckoutSessionId;
  }

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
      stripeCheckoutSessionId: stripeCheckoutSessionId ?? null,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      metadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: updateSet,
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
    currentPeriodStart: toDate(getSubscriptionPeriodStart(stripeSubscription)),
    currentPeriodEnd: toDate(getSubscriptionPeriodEnd(stripeSubscription)),
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
  console.log("[stripe-webhook] received webhook request");

  try {
    const stripe = getStripeClient();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[stripe-webhook] missing stripe-signature header");
      return jsonError("Missing Stripe signature.", 400);
    }

    const secret = getWebhookSecret();
    console.log("[stripe-webhook] secret configured, length:", secret.length);
    const payload = await request.text();

    event = stripe.webhooks.constructEvent(payload, signature, secret);
    console.log("[stripe-webhook] event verified, type:", event.type);
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
        console.log("[stripe-webhook] checkout.session.completed, mode:", session.mode, "client_ref_id:", session.client_reference_id);

        if (session.mode !== "subscription") {
          console.log("[stripe-webhook] skipping non-subscription session");
          break;
        }

        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
        console.log("[stripe-webhook] subscriptionId:", subscriptionId, "customerId:", customerId);

        const userId = await findUserIdFromStripeIdentifiers({
          userId: session.client_reference_id ?? session.metadata?.userId ?? null,
          customerId,
          subscriptionId,
        });

        console.log("[stripe-webhook] resolved userId:", userId);

        if (!userId || !subscriptionId) {
          console.error("[stripe-webhook] missing userId or subscriptionId, aborting");
          break;
        }

        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log("[stripe-webhook] stripe subscription status:", stripeSubscription.status, "planId:", stripeSubscription.metadata?.planId);
        await syncStripeSubscription({
          userId,
          stripeSubscription,
          stripeCheckoutSessionId: session.id,
        });
        console.log("[stripe-webhook] subscription synced successfully for userId:", userId);

        // Send activation email if subscription is active
        if (stripeSubscription.status === "active" || stripeSubscription.status === "trialing") {
          const planId = stripeSubscription.metadata?.planId;
          const plan = getBillingPlan(planId);
          const periodEnd = getSubscriptionPeriodEnd(stripeSubscription);
          await sendSubscriptionActivatedEmail(
            userId,
            plan?.name ?? "Premium",
            periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          );
        }
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
          currentPeriodStart: toDate(getSubscriptionPeriodStart(stripeSubscription)),
          currentPeriodEnd: toDate(getSubscriptionPeriodEnd(stripeSubscription) ?? (stripeSubscription as any).canceled_at),
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

  console.log("[stripe-webhook] completed successfully");

  return NextResponse.json({ received: true });
}
