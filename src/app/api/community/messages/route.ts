import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { communityDMs, communityProfiles, user } from "@/db/schema";
import { eq, or, and, desc, sql } from "drizzle-orm";

function buildAuthHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const authz = req.headers.get("authorization");
  if (authz) h.set("authorization", authz);
  return h;
}

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session) {
    console.warn("/api/community/messages GET unauthorized", {
      hasCookie: Boolean(req.headers.get("cookie")),
      origin: req.headers.get("origin"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const withUser = searchParams.get("withUser"); // get conversation with a specific user
  const conversationsOnly = searchParams.get("conversations"); // list all conversations

  if (conversationsOnly === "true") {
    // Get all unique conversations for this user with last message and unread count
    const allMessages = await db
      .select()
      .from(communityDMs)
      .where(
        or(
          eq(communityDMs.senderId, session.user.id),
          eq(communityDMs.receiverId, session.user.id)
        )
      )
      .orderBy(desc(communityDMs.createdAt));

    // Group by conversation partner
    const conversationMap = new Map<string, {
      partnerId: string;
      lastMessage: string;
      lastMessageAt: string;
      unreadCount: number;
      projectId: number | null;
    }>();

    for (const msg of allMessages) {
      const partnerId = msg.senderId === session.user.id ? msg.receiverId : msg.senderId;
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partnerId,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
          unreadCount: 0,
          projectId: msg.projectId,
        });
      }
      if (msg.receiverId === session.user.id && !msg.isRead) {
        const conv = conversationMap.get(partnerId)!;
        conv.unreadCount++;
      }
    }

    // Fetch partner profiles
    const conversations = [];
    for (const [, conv] of conversationMap) {
      const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, conv.partnerId));
      const [u] = await db.select().from(user).where(eq(user.id, conv.partnerId));
      conversations.push({
        ...conv,
        partnerName: profile?.displayName || u?.name || "Unknown",
        partnerImage: u?.image || null,
        partnerType: profile?.userType || "unknown",
        partnerHeadline: profile?.headline || null,
      });
    }

    return NextResponse.json({ conversations });
  }

  if (withUser) {
    // Get messages between current user and specific user
    const ids = [session.user.id, withUser].sort();
    const convKey = `${ids[0]}_${ids[1]}`;

    const messages = await db
      .select()
      .from(communityDMs)
      .where(eq(communityDMs.conversationKey, convKey))
      .orderBy(communityDMs.createdAt);

    // Mark messages as read
    await db
      .update(communityDMs)
      .set({ isRead: true })
      .where(
        and(
          eq(communityDMs.conversationKey, convKey),
          eq(communityDMs.receiverId, session.user.id),
          eq(communityDMs.isRead, false)
        )
      );

    return NextResponse.json({ messages });
  }

  return NextResponse.json({ error: "Provide ?conversations=true or ?withUser=<userId>" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session) {
    console.warn("/api/community/messages POST unauthorized", {
      hasCookie: Boolean(req.headers.get("cookie")),
      origin: req.headers.get("origin"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { receiverId, message, projectId, proposalId } = body;

    if (!receiverId || !message) {
      return NextResponse.json({ error: "receiverId and message are required" }, { status: 400 });
    }

    const receiverIdStr = String(receiverId);
    const senderIdStr = String(session.user.id);

    // Validate that the receiver exists in the user table
    const [receiver] = await db.select({ id: user.id }).from(user).where(eq(user.id, receiverIdStr));
    if (!receiver) {
      return NextResponse.json(
        { error: "This user is not available for messaging. They may be a demo profile." },
        { status: 400 }
      );
    }

    const ids = [senderIdStr, receiverIdStr].sort();
    const convKey = `${ids[0]}_${ids[1]}`;
    const now = new Date().toISOString();

    let newMsg;
    try {
      const result = await db.insert(communityDMs).values({
        conversationKey: convKey,
        senderId: senderIdStr,
        receiverId: receiverIdStr,
        message: String(message),
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      }).returning();
      newMsg = result[0];
    } catch (dbErr) {
      console.error("DB insert with returning() failed, trying without:", dbErr);
      // Fallback: insert without returning and construct the response manually
      await db.insert(communityDMs).values({
        conversationKey: convKey,
        senderId: senderIdStr,
        receiverId: receiverIdStr,
        message: String(message),
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      });
      // Fetch the last inserted message for this conversation
      const recent = await db.select().from(communityDMs)
        .where(eq(communityDMs.conversationKey, convKey))
        .orderBy(desc(communityDMs.createdAt))
        .limit(1);
      newMsg = recent[0] || {
        id: Date.now(),
        conversationKey: convKey,
        senderId: senderIdStr,
        receiverId: receiverIdStr,
        message: String(message),
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      };
    }

    return NextResponse.json({ message: newMsg });
  } catch (error) {
    console.error("Error sending community message:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: errMsg }, { status: 500 });
  }
}

// Mark messages as read
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session) {
    console.warn("/api/community/messages PATCH unauthorized", {
      hasCookie: Boolean(req.headers.get("cookie")),
      origin: req.headers.get("origin"),
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { withUser } = body;

  if (!withUser) {
    return NextResponse.json({ error: "withUser is required" }, { status: 400 });
  }

  const ids = [session.user.id, withUser].sort();
  const convKey = `${ids[0]}_${ids[1]}`;

  await db
    .update(communityDMs)
    .set({ isRead: true })
    .where(
      and(
        eq(communityDMs.conversationKey, convKey),
        eq(communityDMs.receiverId, session.user.id),
        eq(communityDMs.isRead, false)
      )
    );

  return NextResponse.json({ success: true });
}
