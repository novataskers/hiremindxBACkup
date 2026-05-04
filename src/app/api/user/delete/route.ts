import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  user,
  session as sessionTable,
  account,
  verification,
  resumes,
  applications,
  jobSearches,
  cvAnalysis,
  leads,
  emailCampaigns,
  chatSessions,
  chatMessages,
  conversationParticipants,
  communityMessages,
  invitations,
  hiremindState,
  communityProfiles,
  hiringPositions,
  candidateCVs,
  cvAnalysisResults,
  examQuestionSessions,
  freelancerPortfolio,
  freelancerOffers,
  clientProjects,
  proposals,
  communityDMs,
  interviewQuestionSessions,
  researchSessions,
  predictions,
  notifications,
  subscriptions,
  userUsageLimits,
  canvasProjects,
  escrowTransactions,
  paymentMethods,
  freelancerWallets,
  walletTransactions,
  cancellationRecords,
} from "@/db/schema";
import { eq, inArray, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cookies } from "next/headers";
import { getStripeClient } from "@/lib/stripe";
import { isActiveSubscriptionStatus } from "@/lib/billing";

export async function DELETE(request: NextRequest) {
  try {
    const hdrs = await headers();

    // Try better-auth session first
    let userId: string | null = null;
    const session = await auth.api.getSession({ headers: hdrs });
    if (session?.user?.id) {
      userId = session.user.id;
    }

    // Fall back to devSession cookie
    if (!userId) {
      const cookieStore = await cookies();
      const devSessionCookie = cookieStore.get("devSession");
      if (devSessionCookie) {
        try {
          const devSession = JSON.parse(decodeURIComponent(devSessionCookie.value));
          if (devSession?.user?.id) {
            userId = devSession.user.id;
          }
        } catch {}
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ── Cancel Stripe subscription first ──
    try {
      const subRows = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      const sub = subRows[0] ?? null;
      if (sub?.stripeSubscriptionId && isActiveSubscriptionStatus(sub.status)) {
        const stripe = getStripeClient();
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId).catch(() => {});
      }
    } catch {
      // Stripe may not be configured (e.g. dev env) — continue deletion regardless
    }

    // ── Delete chat messages (depends on chatSessions) ──
    const userChatSessions = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId));
    const sessionIds = userChatSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await db.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds));
    }

    // ── Delete community messages and conversation participation ──
    await db.delete(communityMessages).where(eq(communityMessages.senderId, userId));
    await db.delete(conversationParticipants).where(eq(conversationParticipants.userId, userId));

    // ── Delete community DMs (sent or received) ──
    await db.delete(communityDMs).where(or(eq(communityDMs.senderId, userId), eq(communityDMs.receiverId, userId)));

    // ── Delete CV analysis results and candidate CVs via hiring positions ──
    const userPositions = await db
      .select({ id: hiringPositions.id })
      .from(hiringPositions)
      .where(eq(hiringPositions.userId, userId));
    const positionIds = userPositions.map((p) => p.id);
    if (positionIds.length > 0) {
      const positionCVs = await db
        .select({ id: candidateCVs.id })
        .from(candidateCVs)
        .where(inArray(candidateCVs.positionId, positionIds));
      const cvIds = positionCVs.map((c) => c.id);
      if (cvIds.length > 0) {
        await db.delete(cvAnalysisResults).where(inArray(cvAnalysisResults.cvId, cvIds));
      }
      await db.delete(candidateCVs).where(inArray(candidateCVs.positionId, positionIds));
    }

    // ── Delete proposals by user ──
    await db.delete(proposals).where(eq(proposals.userId, userId));

    // ── Delete escrow transactions (user is client OR freelancer) ──
    await db.delete(escrowTransactions).where(or(eq(escrowTransactions.clientId, userId), eq(escrowTransactions.freelancerId, userId)));

    // ── Delete all user-owned data ──
    await db.delete(chatSessions).where(eq(chatSessions.userId, userId));
    await db.delete(interviewQuestionSessions).where(eq(interviewQuestionSessions.userId, userId));
    await db.delete(examQuestionSessions).where(eq(examQuestionSessions.userId, userId));
    await db.delete(researchSessions).where(eq(researchSessions.userId, userId));
    await db.delete(predictions).where(eq(predictions.userId, userId));
    await db.delete(canvasProjects).where(eq(canvasProjects.userId, userId));
    await db.delete(freelancerPortfolio).where(eq(freelancerPortfolio.userId, userId));
    await db.delete(freelancerOffers).where(eq(freelancerOffers.userId, userId));
    await db.delete(clientProjects).where(eq(clientProjects.userId, userId));
    await db.delete(hiringPositions).where(eq(hiringPositions.userId, userId));
    await db.delete(communityProfiles).where(eq(communityProfiles.userId, userId));
    await db.delete(hiremindState).where(eq(hiremindState.userId, userId));
    await db.delete(invitations).where(eq(invitations.inviterId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(userUsageLimits).where(eq(userUsageLimits.userId, userId));
    await db.delete(walletTransactions).where(eq(walletTransactions.userId, userId));
    await db.delete(freelancerWallets).where(eq(freelancerWallets.userId, userId));
    await db.delete(paymentMethods).where(eq(paymentMethods.userId, userId));
    await db.delete(cancellationRecords).where(eq(cancellationRecords.userId, userId));
    await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await db.delete(emailCampaigns).where(eq(emailCampaigns.userId, userId));
    await db.delete(leads).where(eq(leads.userId, userId));
    await db.delete(cvAnalysis).where(eq(cvAnalysis.userId, userId));
    await db.delete(jobSearches).where(eq(jobSearches.userId, userId));
    await db.delete(applications).where(eq(applications.userId, userId));
    await db.delete(resumes).where(eq(resumes.userId, userId));
    await db.delete(verification).where(eq(verification.identifier, userId));
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
    await db.delete(account).where(eq(account.userId, userId));
    await db.delete(user).where(eq(user.id, userId));

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: `Failed to delete account: ${error?.message || error}` },
      { status: 500 }
    );
  }
}
