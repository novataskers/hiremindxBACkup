import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { escrowTransactions, freelancerWallets, walletTransactions, cancellationRecords, notifications } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getStripeClient } from "@/lib/stripe";

function buildAuthHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const authz = req.headers.get("authorization");
  if (authz) h.set("authorization", authz);
  return h;
}

const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 hours

// GET — fetch escrow transactions for the current user
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const contractId = searchParams.get("contractId");

  try {
    let rows;
    if (contractId) {
      rows = await db.select().from(escrowTransactions)
        .where(eq(escrowTransactions.contractId, contractId))
        .orderBy(desc(escrowTransactions.createdAt));
    } else {
      rows = await db.select().from(escrowTransactions)
        .where(
          eq(escrowTransactions.clientId, session.user.id)
        )
        .orderBy(desc(escrowTransactions.createdAt));
      
      // Also get ones where user is freelancer
      const freelancerRows = await db.select().from(escrowTransactions)
        .where(eq(escrowTransactions.freelancerId, session.user.id))
        .orderBy(desc(escrowTransactions.createdAt));

      const idSet = new Set(rows.map(r => r.id));
      for (const row of freelancerRows) {
        if (!idSet.has(row.id)) {
          rows.push(row);
          idSet.add(row.id);
        }
      }
    }

    return NextResponse.json({ escrowTransactions: rows });
  } catch (error: any) {
    console.error("Error fetching escrow transactions:", error);
    return NextResponse.json({ error: "Failed to fetch escrow data" }, { status: 500 });
  }
}

// POST — create/fund escrow, release money, or cancel
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "fund": {
        // Client funds escrow — create a real Stripe PaymentIntent
        const { contractId, freelancerId, contractAmount, paymentMethodId } = body;
        if (!contractId || !freelancerId || !contractAmount) {
          return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const amountPence = Math.round(Number(contractAmount) * 100);
        const platformFee = Math.round(amountPence * 0.1); // 10% platform fee
        const totalCharged = amountPence + platformFee;
        const now = new Date().toISOString();
        const stripe = getStripeClient();

        // Create Stripe PaymentIntent to charge the client
        // Money stays in the platform's Stripe account until freelancer withdraws
        let paymentIntent;
        try {
          paymentIntent = await stripe.paymentIntents.create({
            amount: totalCharged,
            currency: "gbp",
            customer: undefined, // Can be enhanced to use Stripe Customer IDs
            payment_method: paymentMethodId || undefined,
            confirm: !!paymentMethodId,
            off_session: !!paymentMethodId,
            metadata: {
              contractId,
              clientId: session.user.id,
              freelancerId,
              contractAmount: String(amountPence),
              platformFee: String(platformFee),
              type: "escrow_fund",
            },
            description: `Escrow funding for contract ${contractId}`,
          });
        } catch (stripeError: any) {
          console.error("[escrow/fund] Stripe PaymentIntent creation failed:", stripeError);
          return NextResponse.json(
            { error: stripeError.message || "Failed to process payment" },
            { status: 400 }
          );
        }

        // Create escrow transaction
        const [escrow] = await db.insert(escrowTransactions).values({
          contractId,
          clientId: session.user.id,
          freelancerId,
          contractAmount: amountPence,
          platformFee,
          totalCharged,
          status: paymentIntent.status === "succeeded" ? "funded" : "pending",
          paymentMethodId: paymentMethodId || null,
          stripePaymentIntentId: paymentIntent.id,
          fundedAt: now,
          createdAt: now,
          updatedAt: now,
        }).returning();

        // Create or update freelancer wallet (add to pending)
        const [existingWallet] = await db.select().from(freelancerWallets)
          .where(eq(freelancerWallets.userId, freelancerId));

        if (existingWallet) {
          await db.update(freelancerWallets)
            .set({
              pendingBalance: existingWallet.pendingBalance + amountPence,
              updatedAt: now,
            })
            .where(eq(freelancerWallets.userId, freelancerId));
        } else {
          await db.insert(freelancerWallets).values({
            userId: freelancerId,
            availableBalance: 0,
            pendingBalance: amountPence,
            totalEarned: 0,
            totalWithdrawn: 0,
            updatedAt: now,
          });
        }

        // Notify freelancer
        await db.insert(notifications).values({
          userId: freelancerId,
          type: "escrow_funded",
          title: "Contract Funded",
          message: `The client has funded the escrow for £${(amountPence / 100).toFixed(2)}. The money is held securely until you complete the work.`,
          isRead: false,
          createdAt: now,
        });

        return NextResponse.json({
          success: true,
          escrow,
          paymentIntentStatus: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
        });
      }

      case "release": {
        // Client releases money from escrow — update freelancer balance only.
        // Actual funds stay in the platform's Stripe account until freelancer withdraws.
        const { contractId: releaseContractId } = body;
        if (!releaseContractId) {
          return NextResponse.json({ error: "Missing contractId" }, { status: 400 });
        }

        const [escrow] = await db.select().from(escrowTransactions)
          .where(and(
            eq(escrowTransactions.contractId, releaseContractId),
            eq(escrowTransactions.status, "funded"),
          ));

        if (!escrow) {
          return NextResponse.json({ error: "No funded escrow found for this contract" }, { status: 404 });
        }

        // Only client can release
        if (escrow.clientId !== session.user.id) {
          return NextResponse.json({ error: "Only the client can release funds" }, { status: 403 });
        }

        const now = new Date().toISOString();

        // Update escrow status
        await db.update(escrowTransactions)
          .set({
            status: "released",
            releasedAt: now,
            updatedAt: now,
          })
          .where(eq(escrowTransactions.id, escrow.id));

        // Move money from pending to available in freelancer wallet
        const [wallet] = await db.select().from(freelancerWallets)
          .where(eq(freelancerWallets.userId, escrow.freelancerId));

        if (wallet) {
          await db.update(freelancerWallets)
            .set({
              pendingBalance: Math.max(0, wallet.pendingBalance - escrow.contractAmount),
              availableBalance: wallet.availableBalance + escrow.contractAmount,
              totalEarned: wallet.totalEarned + escrow.contractAmount,
              updatedAt: now,
            })
            .where(eq(freelancerWallets.userId, escrow.freelancerId));
        }

        // Record the credit transaction
        await db.insert(walletTransactions).values({
          userId: escrow.freelancerId,
          type: "credit",
          amount: escrow.contractAmount,
          fee: 0,
          netAmount: escrow.contractAmount,
          contractId: releaseContractId,
          description: `Payment received for contract`,
          status: "completed",
          createdAt: now,
        });

        // Notify freelancer
        await db.insert(notifications).values({
          userId: escrow.freelancerId,
          type: "payment_received",
          title: "Payment Received! 🎉",
          message: `£${(escrow.contractAmount / 100).toFixed(2)} has been added to your balance. You can withdraw it anytime from your profile.`,
          isRead: false,
          createdAt: now,
        });

        // Mark escrow as completed
        await db.update(escrowTransactions)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(escrowTransactions.id, escrow.id));

        return NextResponse.json({ success: true });
      }

      case "cancel": {
        // Cancel a contract (with penalty logic)
        const { contractId: cancelContractId } = body;
        if (!cancelContractId) {
          return NextResponse.json({ error: "Missing contractId" }, { status: 400 });
        }

        const [escrow] = await db.select().from(escrowTransactions)
          .where(and(
            eq(escrowTransactions.contractId, cancelContractId),
            eq(escrowTransactions.status, "funded"),
          ));

        if (!escrow) {
          return NextResponse.json({ error: "No funded escrow found" }, { status: 404 });
        }

        const now = new Date().toISOString();
        const fundedAt = new Date(escrow.fundedAt || escrow.createdAt).getTime();
        const timeSinceFunded = Date.now() - fundedAt;
        const withinGracePeriod = timeSinceFunded < GRACE_PERIOD_MS;

        // Determine user type
        const isClient = escrow.clientId === session.user.id;
        const isFreelancer = escrow.freelancerId === session.user.id;
        if (!isClient && !isFreelancer) {
          return NextResponse.json({ error: "Not authorized" }, { status: 403 });
        }

        const userType = isClient ? "client" : "freelancer";

        // Count prior late cancellations
        const priorCancellations = await db.select().from(cancellationRecords)
          .where(and(
            eq(cancellationRecords.userId, session.user.id),
            eq(cancellationRecords.wasWithinGracePeriod, false),
          ));
        const priorLateCount = priorCancellations.length;

        let penaltyApplied = "none";
        let isBanned = false;
        let refundAmount = escrow.contractAmount;

        if (!withinGracePeriod) {
          if (isClient) {
            if (priorLateCount === 0) {
              penaltyApplied = "platform_fee";
              // Keep platform fee, refund contract amount
            } else {
              penaltyApplied = "double_fee";
              isBanned = true;
              refundAmount = Math.max(0, escrow.contractAmount - escrow.platformFee); // Double fee (20% total)
            }
          } else {
            // Freelancer
            if (priorLateCount === 0) {
              penaltyApplied = "platform_fee_next";
            } else {
              penaltyApplied = "ban";
              isBanned = true;
            }
          }
        }

        // Refund via Stripe if within grace period
        let stripeRefund = null;
        if (withinGracePeriod && escrow.stripePaymentIntentId) {
          const stripe = getStripeClient();
          try {
            stripeRefund = await stripe.refunds.create({
              payment_intent: escrow.stripePaymentIntentId,
              metadata: {
                contractId: cancelContractId,
                cancelledBy: session.user.id,
                reason: "escrow_cancellation_grace_period",
              },
            });
          } catch (refundError: any) {
            console.error("[escrow/cancel] Stripe refund failed:", refundError);
            return NextResponse.json(
              { error: "Failed to process refund. Please contact support." },
              { status: 500 }
            );
          }
        }

        // Record cancellation
        await db.insert(cancellationRecords).values({
          userId: session.user.id,
          userType,
          contractId: cancelContractId,
          cancelledAt: now,
          wasWithinGracePeriod: withinGracePeriod,
          penaltyApplied,
          isBanned,
          createdAt: now,
        });

        // Update escrow
        await db.update(escrowTransactions)
          .set({
            status: withinGracePeriod ? "refunded" : "cancelled",
            cancelledAt: now,
            updatedAt: now,
          })
          .where(eq(escrowTransactions.id, escrow.id));

        // Update freelancer wallet pending balance
        const [wallet] = await db.select().from(freelancerWallets)
          .where(eq(freelancerWallets.userId, escrow.freelancerId));

        if (wallet) {
          await db.update(freelancerWallets)
            .set({
              pendingBalance: Math.max(0, wallet.pendingBalance - escrow.contractAmount),
              updatedAt: now,
            })
            .where(eq(freelancerWallets.userId, escrow.freelancerId));
        }

        // Notify other party
        const otherUserId = isClient ? escrow.freelancerId : escrow.clientId;
        await db.insert(notifications).values({
          userId: otherUserId,
          type: "contract_cancelled",
          title: "Contract Cancelled",
          message: isBanned
            ? `A contract has been cancelled. The cancelling party has been banned from the community due to repeated late cancellations.`
            : withinGracePeriod
              ? `A contract has been cancelled within the grace period. A full refund of £${(escrow.totalCharged / 100).toFixed(2)} has been initiated to the client.`
              : `A contract has been cancelled after the 12-hour grace period. The platform fee penalty has been applied.`,
          isRead: false,
          createdAt: now,
        });

        return NextResponse.json({
          success: true,
          withinGracePeriod,
          penaltyApplied,
          isBanned,
          refundId: stripeRefund?.id || null,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Escrow API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
