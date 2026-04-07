import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { account, user } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    const { to, subject, message } = await request.json();
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    }

    if (!to || !subject || !message) {
      return NextResponse.json({ error: "to, subject, and message are required" }, { status: 400 });
    }

    const userRecord = await db.query.user.findFirst({
      where: eq(user.id, sessionId),
    });

    if (!userRecord) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Try Google first, then Microsoft
    const googleAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, sessionId),
        eq(account.providerId, "google")
      ),
    });

    const microsoftAccount = await db.query.account.findFirst({
      where: and(
        eq(account.userId, sessionId),
        eq(account.providerId, "microsoft")
      ),
    });

    if (!googleAccount && !microsoftAccount) {
      return NextResponse.json({ error: "No Google or Microsoft account linked. Sign in with Google or Microsoft to send emails." }, { status: 404 });
    }

    // Prefer the provider that has a valid token; fall back to whichever exists
    const provider = googleAccount ? "google" : "microsoft";
    const linkedAccount = googleAccount || microsoftAccount;

    let accessToken = linkedAccount!.accessToken;
    const tokenExpiry = linkedAccount!.accessTokenExpiresAt;
    const isExpired = tokenExpiry && new Date(tokenExpiry) < new Date();

    if (isExpired && linkedAccount!.refreshToken) {
      const refreshed = provider === "google"
        ? await refreshGoogleToken(linkedAccount!.refreshToken!)
        : await refreshMicrosoftToken(linkedAccount!.refreshToken!);

      if (refreshed) {
        await db.update(account)
          .set({
            accessToken: refreshed.access_token,
            accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
            ...(refreshed.refresh_token ? { refreshToken: refreshed.refresh_token } : {}),
            updatedAt: new Date(),
          })
          .where(eq(account.id, linkedAccount!.id));

        accessToken = refreshed.access_token;
      } else {
        return NextResponse.json({ error: "Failed to refresh token. User needs to re-authenticate." }, { status: 401 });
      }
    }

    if (!accessToken) {
      return NextResponse.json({ error: "No access token available" }, { status: 401 });
    }

    // Send via the appropriate provider
    if (provider === "microsoft") {
      return await sendViaMicrosoft(accessToken, to, subject, message);
    } else {
      return await sendViaGmail(accessToken, to, subject, message);
    }

  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Gmail ───────────────────────────────────────────────────────────────────

async function sendViaGmail(accessToken: string, to: string, subject: string, message: string) {
  const hasNonAscii = /[^\x00-\x7F]/.test(subject);
  const encodedSubject = hasNonAscii
    ? `=?UTF-8?B?${Buffer.from(subject, 'utf-8').toString('base64')}?=`
    : subject;

  const emailContent = [
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(message, 'utf-8').toString('base64')
  ].join('\n');

  const base64Email = Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64Email }),
  });

  if (!gmailResponse.ok) {
    const errorData = await gmailResponse.json();
    console.error("Gmail API error:", errorData);
    return NextResponse.json({ error: "Failed to send email", details: errorData }, { status: gmailResponse.status });
  }

  const result = await gmailResponse.json();
  return NextResponse.json({ success: true, message: `Email sent to ${to}`, messageId: result.id, provider: "google" });
}

// ── Microsoft Graph ─────────────────────────────────────────────────────────

async function sendViaMicrosoft(accessToken: string, to: string, subject: string, message: string) {
  const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject,
        body: {
          contentType: "HTML",
          content: message,
        },
        toRecipients: [
          { emailAddress: { address: to } },
        ],
      },
      saveToSentItems: true,
    }),
  });

  if (!graphResponse.ok) {
    const errorData = await graphResponse.json();
    console.error("Microsoft Graph API error:", errorData);
    return NextResponse.json({ error: "Failed to send email", details: errorData }, { status: graphResponse.status });
  }

  // Microsoft Graph sendMail returns 202 with no body on success
  return NextResponse.json({ success: true, message: `Email sent to ${to}`, provider: "microsoft" });
}

// ── Token refresh ───────────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function refreshMicrosoftToken(refreshToken: string) {
  try {
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
        scope: "openid profile email offline_access https://graph.microsoft.com/Mail.Send",
      }),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
