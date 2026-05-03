import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { communityDMs, communityProfiles, notifications, user } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import sendHireMindXEmailNotification from "@/lib/email/sendHireMindXEmailNotification";

function formatConversationPreview(message: string) {
  if (typeof message !== "string") return "";

  if (message.startsWith("[CONTRACT_OFFER_JSON]")) {
    try {
      const parsed = JSON.parse(message.replace("[CONTRACT_OFFER_JSON]", ""));
      if (parsed?.type === "contract_offer") {
        const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : "Contract Offer";
        return `📄 Contract Offer: ${title}`;
      }
    } catch {}
    return "📄 Contract Offer";
  }

  if (message.startsWith("[CONTRACT_RESPONSE]")) {
    try {
      const parsed = JSON.parse(message.replace("[CONTRACT_RESPONSE]", ""));
      if (parsed?.action === "accepted") return "✅ Contract accepted";
      if (parsed?.action === "declined") return "❌ Contract declined";
    } catch {}
    return "📄 Contract updated";
  }

  if (message.startsWith("[CONTRACT_CANCEL]")) {
    return "⚠️ Contract cancelled";
  }

  return message;
}

function buildAuthHeaders(req: NextRequest) {
  const h = new Headers(req.headers);
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);
  const authz = req.headers.get("authorization");
  if (authz) h.set("authorization", authz);
  return h;
}

function normalizeAttachmentsValue(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function isDemoOrMockUser(userId: string, email?: string | null) {
  const normalizedId = String(userId || "").toLowerCase();
  const normalizedEmail = String(email || "").toLowerCase();

  return (
    normalizedId.includes("demo") ||
    normalizedId.startsWith("free_") ||
    normalizedId.length < 10 ||
    normalizedEmail.endsWith("@hiremindx.demo") ||
    normalizedEmail.includes("demo") ||
    normalizedEmail.includes("mock")
  );
}

function getBaseSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

function parseCommunityMessageType(message: string) {
  if (message.startsWith("[CONTRACT_OFFER_JSON]")) {
    try {
      const parsed = JSON.parse(message.replace("[CONTRACT_OFFER_JSON]", ""));
      return { kind: "contract_offer" as const, data: parsed };
    } catch {
      return { kind: "contract_offer" as const, data: null };
    }
  }

  if (message.startsWith("[CONTRACT_RESPONSE]")) {
    try {
      const parsed = JSON.parse(message.replace("[CONTRACT_RESPONSE]", ""));
      return { kind: "contract_response" as const, data: parsed };
    } catch {
      return { kind: "contract_response" as const, data: null };
    }
  }

  if (message.startsWith("[CONTRACT_CANCEL]")) {
    try {
      const parsed = JSON.parse(message.replace("[CONTRACT_CANCEL]", ""));
      return { kind: "contract_cancel" as const, data: parsed };
    } catch {
      return { kind: "contract_cancel" as const, data: null };
    }
  }

  return { kind: "message" as const, data: null };
}

function buildNotificationPayload(messageValue: string, senderName: string) {
  const parsed = parseCommunityMessageType(messageValue);

  if (parsed.kind === "contract_offer") {
    const titleText =
      typeof parsed.data?.title === "string" && parsed.data.title.trim()
        ? parsed.data.title.trim()
        : "Contract Offer";

    return {
      notificationType: "contract_offer",
      emailVariant: "contract_offer" as const,
      title: "New contract offer",
      message: `${senderName} sent you a contract offer: ${titleText}.`,
      emailSubject: `New contract offer from ${senderName}`,
      emailSummary: `${senderName} sent you a contract offer on HireMindX.`,
      ctaUrl: `${getBaseSiteUrl()}/community`,
    };
  }

  if (parsed.kind === "contract_response") {
    const action =
      parsed.data?.action === "accepted"
        ? "accepted"
        : parsed.data?.action === "declined"
          ? "declined"
          : "updated";

    return {
      notificationType: "contract_response",
      emailVariant: "contract_response" as const,
      title: "Contract response received",
      message: `${senderName} ${action} your contract offer.`,
      emailSubject: `Contract ${action} by ${senderName}`,
      emailSummary: `${senderName} ${action} a contract on HireMindX.`,
      ctaUrl: `${getBaseSiteUrl()}/community`,
    };
  }

  if (parsed.kind === "contract_cancel") {
    return {
      notificationType: "contract_response",
      emailVariant: "contract_response" as const,
      title: "Contract cancelled",
      message: `${senderName} cancelled a contract conversation.`,
      emailSubject: `Contract cancelled by ${senderName}`,
      emailSummary: `${senderName} cancelled a contract on HireMindX.`,
      ctaUrl: `${getBaseSiteUrl()}/community`,
    };
  }

  return {
    notificationType: "message",
    emailVariant: "message" as const,
    title: "New message",
    message: `${senderName} sent you a new message.`,
    emailSubject: `New message from ${senderName}`,
    emailSummary: `${senderName} sent you a new message on HireMindX.`,
    ctaUrl: `${getBaseSiteUrl()}/community`,
  };
}

async function createNotificationAndEmail(params: {
  receiverId: string;
  receiverEmail?: string | null;
  senderName: string;
  rawMessage: string;
}) {
  const payload = buildNotificationPayload(params.rawMessage, params.senderName);

  try {
    await db.insert(notifications).values({
      userId: params.receiverId,
      type: payload.notificationType,
      title: payload.title,
      message: payload.message,
      actionUrl: payload.ctaUrl,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to create community notification:", error);
  }

  if (!params.receiverEmail || isDemoOrMockUser(params.receiverId, params.receiverEmail)) {
    return;
  }

  try {
    const emailResult = await sendHireMindXEmailNotification({
      to: params.receiverEmail,
      subject: payload.emailSubject,
      variant: payload.emailVariant,
      title: payload.title,
      summary: payload.emailSummary,
      recipientName: params.senderName,
      ctaUrl: payload.ctaUrl,
      ctaLabel: "View conversation",
      metadata: [
        {
          label: "Sender",
          value: params.senderName,
        },
      ],
    });

    console.log("[Community email notification]", {
      receiverId: params.receiverId,
      receiverEmail: params.receiverEmail,
      notificationType: payload.notificationType,
      emailVariant: payload.emailVariant,
      success: emailResult.success,
      skipped: emailResult.skipped ?? false,
      error: emailResult.error ?? null,
      messageId: emailResult.messageId ?? null,
    });
  } catch (error) {
    console.error("Failed to send community email notification:", error);
  }
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
  const withUser = searchParams.get("withUser");
  const conversationsOnly = searchParams.get("conversations");

  if (conversationsOnly === "true") {
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
          lastMessage: formatConversationPreview(msg.message),
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
    const ids = [session.user.id, withUser].sort();
    const convKey = `${ids[0]}_${ids[1]}`;

    const messages = await db
      .select()
      .from(communityDMs)
      .where(eq(communityDMs.conversationKey, convKey))
      .orderBy(communityDMs.createdAt);

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

    const normalizedMessages = messages.map((msg) => ({
      ...msg,
      attachments: normalizeAttachmentsValue(msg.attachments),
    }));

    return NextResponse.json({ messages: normalizedMessages });
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

  let receiverIdStr = "";
  let senderIdStr = "";

  try {
    const body = await req.json();
    const { receiverId, message, projectId, proposalId, attachments } = body;

    if (!receiverId || !message) {
      return NextResponse.json({ error: "receiverId and message are required" }, { status: 400 });
    }

    receiverIdStr = String(receiverId);
    senderIdStr = String(session.user.id);

    // Check usage limits
    const { useFeature } = await import("@/lib/usage-limits");
    const usageResult = await useFeature(senderIdStr, "community_messaging");
    if (!usageResult.allowed) {
      return NextResponse.json({
        error: usageResult.upgradeMessage,
        limitReached: true,
        usage: { used: usageResult.currentUsage, limit: usageResult.limit, plan: usageResult.plan },
      }, { status: 429 });
    }

    let [receiver] = await db
      .select({ id: user.id, email: user.email })
      .from(user)
      .where(eq(user.id, receiverIdStr));

    if (!receiver) {
      const mockEmail = `demo_${receiverIdStr}@hiremindx.demo`;
      try {
        await db.insert(user).values({
          id: receiverIdStr,
          name: "Demo Professional",
          email: mockEmail,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        receiver = { id: receiverIdStr, email: mockEmail };
      } catch (e) {
        console.error("Failed to insert mock user:", e);
        return NextResponse.json(
          { error: "This user is not available for messaging." },
          { status: 400 }
        );
      }
    }

    const [sender] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, senderIdStr));

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
        attachments: attachments || null,
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      }).returning();
      newMsg = result[0];
    } catch (dbErr) {
      console.error("DB insert with returning() failed, trying without:", dbErr);
      await db.insert(communityDMs).values({
        conversationKey: convKey,
        senderId: senderIdStr,
        receiverId: receiverIdStr,
        message: String(message),
        attachments: attachments || null,
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      });
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
        attachments: attachments || null,
        projectId: projectId ? Number(projectId) : null,
        proposalId: proposalId ? Number(proposalId) : null,
        isRead: false,
        createdAt: now,
      };
    }

    await createNotificationAndEmail({
      receiverId: receiverIdStr,
      receiverEmail: receiver?.email || null,
      senderName: sender?.name || session.user.name || "Someone",
      rawMessage: String(message),
    });

    const normalizedMsg = {
      ...newMsg,
      attachments: normalizeAttachmentsValue(newMsg.attachments),
    };

    return NextResponse.json({ message: normalizedMsg });
  } catch (error) {
    console.error("Error sending community message:", error);
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Internal Server Error", details: errMsg }, { status: 500 });
  } finally {
    if (!receiverIdStr || !senderIdStr) return;
    if (receiverIdStr.includes("demo") || receiverIdStr.startsWith("free_") || receiverIdStr.length < 10) {
      const ids = [senderIdStr, receiverIdStr].sort();
      const convKey = `${ids[0]}_${ids[1]}`;
      triggerDemoBotReply(receiverIdStr, senderIdStr, convKey);
    }
  }
}

async function triggerDemoBotReply(botId: string, userId: string, convKey: string) {
  setTimeout(async () => {
    try {
      const db = (await import("@/db")).db;
      const { communityDMs } = await import("@/db/schema");
      await db.insert(communityDMs).values({
        conversationKey: convKey,
        senderId: botId,
        receiverId: userId,
        message: "Thanks for reaching out! I typically respond within 24 hours. (This is an automated demo reply)",
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      console.log(`Demo bot reply sent for ${botId}`);
    } catch (err) {
      console.error("Demo bot failed to reply:", err);
    }
  }, 1500);
}

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

export async function DELETE(req: NextRequest) {
  const session = await auth.api.getSession({ headers: buildAuthHeaders(req) });
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationKey = searchParams.get("conversationKey");
  const messageId = searchParams.get("id");

  if (conversationKey) {
    await db.delete(communityDMs).where(
      and(
        eq(communityDMs.conversationKey, conversationKey),
        or(
          eq(communityDMs.senderId, session.user.id),
          eq(communityDMs.receiverId, session.user.id)
        )
      )
    );
    return NextResponse.json({ success: true });
  }

  if (messageId) {
    await db.delete(communityDMs).where(
      and(
        eq(communityDMs.id, parseInt(messageId)),
        eq(communityDMs.senderId, session.user.id)
      )
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Provide ?conversationKey=... or ?id=..." }, { status: 400 });
}
