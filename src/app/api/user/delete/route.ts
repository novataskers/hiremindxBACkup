import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  user,
  session as sessionTable,
  account,
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
  interviewQuestionSessions,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { cookies } from "next/headers";

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

    // Delete chat messages (depends on chatSessions)
    const userChatSessions = await db
      .select({ id: chatSessions.id })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId));
    const sessionIds = userChatSessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await db.delete(chatMessages).where(inArray(chatMessages.sessionId, sessionIds));
    }

    // Delete community messages and conversation participation
    await db.delete(communityMessages).where(eq(communityMessages.senderId, userId));
    await db.delete(conversationParticipants).where(eq(conversationParticipants.userId, userId));

    // Delete CV analysis results and candidate CVs via hiring positions
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

    // Delete all user-owned data
    await db.delete(chatSessions).where(eq(chatSessions.userId, userId));
    await db.delete(interviewQuestionSessions).where(eq(interviewQuestionSessions.userId, userId));
    await db.delete(examQuestionSessions).where(eq(examQuestionSessions.userId, userId));
    await db.delete(freelancerPortfolio).where(eq(freelancerPortfolio.userId, userId));
    await db.delete(hiringPositions).where(eq(hiringPositions.userId, userId));
    await db.delete(communityProfiles).where(eq(communityProfiles.userId, userId));
    await db.delete(hiremindState).where(eq(hiremindState.userId, userId));
    await db.delete(invitations).where(eq(invitations.inviterId, userId));
    await db.delete(emailCampaigns).where(eq(emailCampaigns.userId, userId));
    await db.delete(leads).where(eq(leads.userId, userId));
    await db.delete(cvAnalysis).where(eq(cvAnalysis.userId, userId));
    await db.delete(jobSearches).where(eq(jobSearches.userId, userId));
    await db.delete(applications).where(eq(applications.userId, userId));
    await db.delete(resumes).where(eq(resumes.userId, userId));
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
    await db.delete(account).where(eq(account.userId, userId));
    await db.delete(user).where(eq(user.id, userId));

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
