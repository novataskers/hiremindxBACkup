import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe";

function buildAuthHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const authz = req.headers.get("authorization");
  if (authz) h.set("authorization", authz);
  return h;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET — fetch saved Stripe payment methods
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const methods = await db.select().from(paymentMethods)
      .where(eq(paymentMethods.userId, session.user.id))
      .orderBy(desc(paymentMethods.createdAt));

    return NextResponse.json({ paymentMethods: methods });
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return NextResponse.json({ error: "Failed to fetch payment methods" }, { status: 500 });
  }
}

// POST — attach a new Stripe PaymentMethod
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { paymentMethodId } = body;

    if (!paymentMethodId) {
      return NextResponse.json({ error: "Missing paymentMethodId" }, { status: 400 });
    }

    const stripe = getStripeClient();

    // Retrieve the PaymentMethod from Stripe to verify it exists
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    if (!pm || pm.object !== "payment_method") {
      return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const card = pm.card;

    // Save to our DB
    const [method] = await db.insert(paymentMethods).values({
      userId: session.user.id,
      type: card ? "credit_card" : "other",
      label: card
        ? `${card.brand?.charAt(0).toUpperCase()}${card.brand?.slice(1)} ending ${card.last4}`
        : "Payment method",
      last4: card?.last4 || null,
      cardBrand: card?.brand || null,
      expiryMonth: card?.exp_month || null,
      expiryYear: card?.exp_year || null,
      accountId: paymentMethodId, // Store Stripe PaymentMethod ID here
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json({ success: true, paymentMethod: method });
  } catch (error: any) {
    console.error("Error adding payment method:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add payment method" },
      { status: 500 }
    );
  }
}

// DELETE — remove a payment method
export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing payment method id" }, { status: 400 });
    }

    await db.delete(paymentMethods)
      .where(and(
        eq(paymentMethods.id, Number(id)),
        eq(paymentMethods.userId, session.user.id),
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting payment method:", error);
    return NextResponse.json({ error: "Failed to delete payment method" }, { status: 500 });
  }
}
