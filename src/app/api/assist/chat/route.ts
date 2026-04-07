/**
 * Unified HireMindX Assist Brain
 * One single endpoint. Both Mistral API keys used simultaneously.
 * Handles research (streaming), email outreach, CV analysis, company search.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createMistral } from "@ai-sdk/mistral";
import { streamText } from "ai";
import { db } from "@/db";
import mammoth from "mammoth";
import { searchWithSerper } from "@/lib/search-utils";
import { hiremindState, researchSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getEmailToken, type EmailProvider } from "@/lib/google-auth";
import {
  type ConversationState,
  type EmailAttachment,
  createInitialState,
  processMessage,
  serializeState,
  deserializeState,
} from "@/lib/hiremind-agent";

export const maxDuration = 60;

// Primary key: research, streaming, main agent reasoning
const mistralStream = createMistral({ apiKey: process.env.MISTRAL_API_KEY || "" });

// ─── System prompt for research/general mode ─────────────────────────────────
const RESEARCH_SYSTEM_PROMPT = `You are HireMindX Assist, an intelligent all-in-one AI assistant.

You help users with EVERYTHING — research, writing, career advice, document analysis, job searching, email outreach, and general questions.

COMPREHENSION RULES:
- Read the user's message carefully. Pay attention to EVERY detail including the full conversation history.
- Remember context from earlier in the conversation — reference it when relevant.
- NEVER repeat information the user already knows.
- NEVER ask the user to re-provide information they already gave you earlier in the conversation.

PRE-INTERVIEW COMPANY BRIEFING:
- If the user says "brief me for my interview at [Company]", "I have an interview at [Company]", "prepare me for [Company] interview", or similar:
  1. Use the search results provided to pull recent news, funding, products, culture, and layoff info about the company
  2. Research the likely interview format for that company/role
  3. Generate a structured 1-page briefing with sections: Company Overview, Recent News, Culture & Values, Likely Interview Questions, Tips
  4. Make it actionable and specific — not generic advice
  5. Format beautifully with Markdown headers and bullet points

DOCUMENT & PDF GENERATION (CRITICAL):
- If the user says "turn this into a PDF", "make this a PDF", "make a PDF", "convert to PDF", "make a document", "turn this into a doc", or anything similar:
  1. LOOK BACK through the entire conversation history for the content they are referring to
  2. The content could be: a CV you wrote, a paragraph about a topic, research results, any text from a prior message
  3. OUTPUT ONLY THE DOCUMENT CONTENT — formatted cleanly in Markdown. No preamble, no "here is your PDF", no explanation.
  4. Start directly with the document content so it can be downloaded immediately.
  5. NEVER say "I need you to provide content" or "please share the content" — you already have it in the conversation history.
- If the user gives personal info and asks for a CV/resume: generate the full CV immediately, formatted in Markdown with sections (Name, Summary, Experience, Education, Skills). Output ONLY the CV, nothing else.

CROSS-CONTEXT INTELLIGENCE (VERY IMPORTANT):
- The full conversation history is always included. USE IT.
- If the user says "send this as an email to X", "email that to X@domain.com", "send the above to X", etc.:
  1. Look through the conversation history to find what content they're referring to
  2. Structure it into a proper email with greeting and signature
  3. Tell them you'll handle sending it (the system routes to the email agent automatically)
- NEVER say you cannot access previous messages. You always have the full history.

When providing real-time information:
- Use SEARCH RESULTS provided to give up-to-date answers
- Cite sources using Markdown links [Source Name](URL)
- DO NOT include [INTERNAL_CONTEXT] or [SEARCH_RESULTS] headers in your response.

Be sophisticated, helpful, and concise. Use markdown for readability.`;

// ─── Outreach intent detection ────────────────────────────────────────────────
// Returns true ONLY if the user clearly wants to DO something email/outreach related
// (not just ask about email concepts)
function isOutreachMessage(message: string, conversationHistory: { role: string; content: string }[] = []): boolean {
  const lower = message.toLowerCase().trim();

  // Hard patterns — unambiguously want to send/find/draft an email
  const hardPatterns = [
    /\bsend\b.{0,30}\bemail\b/i,
    /\bemail\s+(this|that|it|the|him|her|them)\b/i,
    /\bsend\s+(this|that|it|the)\s+(to|as)\b/i,
    /\bmail\s+(this|that|it)\s+to\b/i,
    /\bforward\s+(this|that|it)\s+to\b/i,
    /\bturn\s+(this|that)\s+into\s+an?\s+email\b/i,
    /\bconvert\s+(this|that)\s+to\s+an?\s+email\b/i,
    /\bsend\s+it\s+as\s+an?\s+email\b/i,
    /\bsend\s+(a\s+)?(cold\s+|outreach\s+|job\s+application\s+)?email\b/i,
    /\bdraft\s+(a\s+|an?\s+)?(cold\s+|outreach\s+|job\s+)?email\b/i,
    /\bcompose\s+(a\s+|an?\s+)?email\b/i,
    /\bwrite\s+(a\s+|an?\s+)?(cold\s+|outreach\s+|job\s+|application\s+)?email\b/i,
    /\bfind\s+(me\s+)?(the\s+)?(email|contact)\s+(address\s+)?(of|for)\b/i,
    /\bget\s+(me\s+)?(the\s+)?email\s+(address|of|for)\b/i,
    /\bjob\s+outreach\b/i,
    /\bcold\s+outreach\b/i,
    /\brecruiter\s+outreach\b/i,
    /\bnetworking\s+email\b/i,
    /\bfollow.?up\s+email\b/i,
    /\bconnect\s+(gmail|outlook|my\s+email)\b/i,
    /\bemail\s+finder\b/i,
    /\blookup\s+linkedin\b/i,
    /\blinkedin\s+(url|profile|outreach)\b/i,
    /\bfind\s+(decision.?makers?|ceo|cto|founder|recruiter)\b/i,
    /\bfind\s+companies\b/i,
    /\bsearch\s+companies\b/i,
  ];

  if (hardPatterns.some(p => p.test(lower))) return true;

  // Explicit email address typed by user → likely wants to do something with it
  const hasEmailAddress = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(message);

  // If there's an email address AND the message implies an action (not just mentioning)
  if (hasEmailAddress) {
    const actionWords = /\b(send|email|mail|contact|reach|write|draft|forward|message)\b/i;
    if (actionWords.test(lower)) return true;
  }

  // Cross-context: user says "send this" / "send that" / "yes" after a prior outreach message
  if (conversationHistory.length > 0) {
    const priorOutreach = conversationHistory.some(
      m => m.role === "user" && isOutreachMessage(m.content)
    );
    if (priorOutreach) {
      // If we're already in an outreach thread, keep routing to agent
      // But only for action-like messages, not new research questions
      const continuePatterns = /\b(yes|send|proceed|go ahead|confirm|ok|okay|sure|do it|send it|looks good|perfect|approved)\b/i;
      const isNewResearchQuestion = message.length > 80 || /\b(what|how|why|when|where|who|tell me|explain|describe|research|find out)\b/i.test(lower);
      if (continuePatterns.test(lower) && !isNewResearchQuestion) return true;
    }
  }

  return false;
}

// ─── Email sending helpers ────────────────────────────────────────────────────
async function sendViaGmailAPI(accessToken: string, to: string, subject: string, body: string, attachments?: EmailAttachment[]) {
  if (!to?.includes('@')) return { success: false, error: `Invalid email: ${to}` };
  const boundary = `boundary_${Date.now()}`;
  let emailContent: string;

  if (attachments && attachments.length > 0) {
    const parts: string[] = [
      `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
      `--${boundary}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 7bit', '', body,
    ];
    for (const att of attachments) {
      const b64 = att.base64.includes(',') ? att.base64.split(',')[1] : att.base64;
      parts.push(`--${boundary}`, `Content-Type: ${att.type}; name="${att.name}"`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${att.name}"`, '', b64);
    }
    parts.push(`--${boundary}--`);
    emailContent = parts.join('\r\n');
  } else {
    emailContent = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset=utf-8', 'MIME-Version: 1.0', '', body].join('\r\n');
  }

  const raw = Buffer.from(emailContent).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) return { success: false, error: await res.json() };
    const result = await res.json();
    return { success: true, messageId: result.id, to };
  } catch (e) { return { success: false, error: String(e) }; }
}

async function sendViaMicrosoftAPI(accessToken: string, to: string, subject: string, body: string, attachments?: EmailAttachment[]) {
  if (!to?.includes('@')) return { success: false, error: `Invalid email: ${to}` };
  const mailBody: any = {
    message: { subject, body: { contentType: "Text", content: body }, toRecipients: [{ emailAddress: { address: to } }] },
    saveToSentItems: true,
  };
  if (attachments?.length) {
    mailBody.message.attachments = attachments.map(att => ({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: att.name, contentType: att.type,
      contentBytes: att.base64.includes(',') ? att.base64.split(',')[1] : att.base64,
    }));
  }
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(mailBody),
    });
    if (!res.ok) return { success: false, error: await res.text() };
    return { success: true, to };
  } catch (e) { return { success: false, error: String(e) }; }
}

// ─── State persistence ────────────────────────────────────────────────────────
async function loadUserState(userId: string): Promise<ConversationState> {
  try {
    const saved = await db.query.hiremindState.findFirst({ where: eq(hiremindState.userId, userId) });
    if (saved?.stateJson) return deserializeState(saved.stateJson);
  } catch (e) { console.error("Error loading user state:", e); }
  return createInitialState();
}

async function saveUserState(userId: string, state: ConversationState): Promise<void> {
  try {
    const stateJson = serializeState(state);
    const now = new Date().toISOString();
    const existing = await db.query.hiremindState.findFirst({ where: eq(hiremindState.userId, userId) });
    if (existing) {
      await db.update(hiremindState).set({ stateJson, updatedAt: now }).where(eq(hiremindState.userId, userId));
    } else {
      await db.insert(hiremindState).values({ userId, stateJson, updatedAt: now });
    }
  } catch (e) { console.error("Error saving user state:", e); }
}

// ─── Document extraction ──────────────────────────────────────────────────────
async function extractTextFromPDF(base64Data: string): Promise<string> {
  const res = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mistral-ocr-latest", document: { type: "document_url", document_url: base64Data } }),
  });
  if (!res.ok) throw new Error(`OCR failed: ${res.status}`);
  const result = await res.json();
  return (result.pages || []).map((p: any) => p.markdown || "").join("\n\n") || "Could not extract text.";
}

async function extractTextFromDOCX(base64Data: string): Promise<string> {
  const base64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
  const result = await mammoth.extractRawText({ buffer: Buffer.from(base64, "base64") });
  return result.value || "Could not extract text.";
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function resolveUserId(headersList: Headers): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: headersList });
    if (session?.user) return session.user.id;
  } catch {}
  // devSession cookie fallback
  const cookie = headersList.get("cookie") || "";
  const devCookie = cookie.split(";").find(c => c.trim().startsWith("devSession="));
  if (devCookie) {
    try {
      const raw = decodeURIComponent(devCookie.split("=").slice(1).join("="));
      const parsed = JSON.parse(raw);
      if (parsed?.user?.id) return parsed.user.id;
    } catch {}
    return "dev-user";
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const userId = await resolveUserId(headersList);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get email for outreach agent (best effort)
    let userEmail: string | undefined;
    try {
      const session = await auth.api.getSession({ headers: headersList });
      userEmail = session?.user?.email || undefined;
    } catch {}
    const body = await request.json();

    const {
      prompt,
      file,
      fileType,
      fileName,
      conversationHistory,
      isDocumentRequest,
      documentType,
      attachments: bodyAttachments,
      reset,
      isCanvasRequest,
    } = body;

    // ── Reset state (new chat started) ──────────────────────────────────────
    if (reset) {
      await saveUserState(userId, createInitialState());
      return NextResponse.json({ status: "reset" });
    }

    const message = prompt || "";
    if (!message && !file) {
      return NextResponse.json({ error: "Message or file is required" }, { status: 400 });
    }

    // Full conversation history from the frontend (all messages, not truncated)
    const fullHistory: { role: "user" | "assistant"; content: string }[] =
      Array.isArray(conversationHistory) ? conversationHistory : [];

    // ── Determine mode ────────────────────────────────────────────────────
    // Pass full history so context-aware detection works (e.g. "yes send it" after outreach)
    const useOutreachAgent = isOutreachMessage(message, fullHistory) && !file;

    // ── OUTREACH / EMAIL AGENT MODE ───────────────────────────────────────
    if (useOutreachAgent) {
      let state = await loadUserState(userId);

      // CRITICAL FIX: Sync agent state with the full frontend conversation history.
      // This is what enables cross-context intelligence: user researches something in
      // research mode, then says "send this as an email" — the agent gets full context.
      //
      // Strategy: rebuild agent's conversationHistory from frontend history every time,
      // keeping the last 40 messages with full content (up to 3000 chars each).
      // This ensures the agent always has complete, fresh context.
      if (fullHistory.length > 0) {
        // Merge: prefer frontend history as ground truth for content, keep agent state
        // for profile/companies/emails data (those live only in the agent state)
        const freshHistory = fullHistory
          .slice(-40)
          .map(m => ({
            role: m.role as "user" | "assistant",
            content: (m.content || "").substring(0, 3000),
          }));
        state.conversationHistory = freshHistory;
      }

      if (bodyAttachments?.length) state.pendingAttachments = bodyAttachments;

        const result = await processMessage(state, message, userEmail, bodyAttachments);
      let finalState = result.state;

      // ── Send emails if agent produced drafts ────────────────────────────
      if (result.emails && result.emails.length > 0) {
        const emailToken = await getEmailToken(userId);

        if (!emailToken) {
          await saveUserState(userId, finalState);
          return NextResponse.json({
            output: result.response + "\n\n⚠️ **Email account not connected.** Please connect your Gmail or Outlook account to send emails.",
            emailsSent: false,
            reason: "no_email_token",
          });
        }

        const sendFn = emailToken.provider === "microsoft" ? sendViaMicrosoftAPI : sendViaGmailAPI;
        const emailAttachments = bodyAttachments || finalState.pendingAttachments;
        const sendResults = [];

        for (const email of result.emails) {
          const sent = await sendFn(
            emailToken.accessToken, email.contact_email, email.subject, email.body,
            email.attachments || emailAttachments
          );
          sendResults.push({ ...sent, company: email.company, to: (sent as any).to || email.contact_email });
        }

        if (finalState.pendingAttachments) delete finalState.pendingAttachments;
        if (!finalState.sentEmails) finalState.sentEmails = [];

        const successes = sendResults.filter(r => r.success);
        if (successes.length > 0) {
          for (const s of successes) {
            const obj = result.emails.find(e => e.contact_email === s.to);
            if (obj) finalState.sentEmails!.push(obj);
          }
          finalState.emails = [];
          finalState.companies = [];
          finalState.step = "chatting";
        }

        await saveUserState(userId, finalState);

        let output = result.response;
        const successCount = successes.length;
        const failCount = sendResults.filter(r => !r.success).length;

        if (successCount > 0) {
          output += `\n\n✅ **Successfully sent ${successCount} email${successCount > 1 ? 's' : ''}!**`;
          output += `\n\n**Sent to:**\n${successes.map((e: any) => `- ${e.company ? e.company + ' (' + e.to + ')' : e.to}`).join('\n')}`;
          if (emailAttachments?.length) output += `\n\n📎 **Attachments included:** ${emailAttachments.map((a: EmailAttachment) => a.name).join(', ')}`;
        }
        if (failCount > 0) {
          output += `\n\n⚠️ **Failed to send ${failCount} email${failCount > 1 ? 's' : ''}.** Your email session may have expired — please reconnect your account.`;
        }

        return NextResponse.json({ output, emailsSent: successCount > 0, emailResults: sendResults, status: "completed" });
      }

      await saveUserState(userId, finalState);
      return NextResponse.json({
        output: result.response,
        status: result.state.step === "complete" ? "completed" : "in_progress",
      });
    }

    // ── RESEARCH / DOCUMENT MODE (streaming) ─────────────────────────────
    let userMessageContent: any = message || "Please analyze this.";
    let model = "mistral-large-latest";
    let documentContext = "";

    if (file) {
      const isImage = fileType?.startsWith("image/");
      const isPDF = fileType === "application/pdf";
      const isDOCX = fileType?.includes("wordprocessingml") || fileName?.toLowerCase().endsWith(".docx");
      const isDOC = fileType === "application/msword" || fileName?.toLowerCase().endsWith(".doc");
      const base64Data = file.includes(",") ? file : `data:${fileType};base64,${file}`;

      if (isImage) {
        model = "pixtral-12b-2409";
        // Ensure we have a proper data URL for the image
        const imageUrl = base64Data.startsWith('data:') ? base64Data : `data:${fileType};base64,${base64Data}`;
        userMessageContent = [
          { type: "text" as const, text: message || "Analyze this image." },
          { type: "image" as const, image: new URL(imageUrl) },
        ];
      } else if (isPDF) {
        documentContext = await extractTextFromPDF(base64Data);
        userMessageContent = `[Document: ${fileName}]\n\n${documentContext}\n\nUser Question: ${message || "Analyze this document."}`;
      } else if (isDOCX || isDOC) {
        documentContext = await extractTextFromDOCX(base64Data);
        userMessageContent = `[Document: ${fileName}]\n\n${documentContext}\n\nUser Question: ${message || "Analyze this document."}`;
      }
    }

    // Build message array with FULL conversation history for research mode
    const messages: Array<{ role: "user" | "assistant"; content: any }> = [];
    if (fullHistory.length > 0) {
      const recent = fullHistory.slice(-40);
      for (const m of recent) {
        if (m.role === "user" || m.role === "assistant") {
          messages.push({ role: m.role, content: m.content });
        }
      }
    }
    messages.push({ role: "user", content: userMessageContent });

      // Smart web search — skip for short conversational messages or file uploads
      let sourcesForFrontend: { title: string; url: string; favicon: string }[] = [];
      if (message && message.length > 10 && !file) {
        const lower = message.toLowerCase().trim();
        const isConversational = /^(hi|hey|hello|thanks|thank you|ok|okay|yes|no|sure|got it|great|cool|nice|bye|goodbye|please|sorry|hmm|hm|yep|nope|yeah|nah|alright|right|exactly|correct|agreed|understood|lol|haha|wow)\b/i.test(lower);
        const wordCount = lower.split(/\s+/).length;
        if (!isConversational && (wordCount > 3 || lower.includes('?'))) {
          try {
            const searchResults = await searchWithSerper(message, 6);
            if (searchResults?.length > 0) {
              // Extract clean sources for the frontend
              sourcesForFrontend = searchResults.map((s: any) => {
                let hostname = '';
                try { hostname = new URL(s.link).hostname.replace('www.', ''); } catch {}
                return {
                  title: s.title || hostname,
                  url: s.link,
                  favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
                };
              });

              const searchContext = "\n\n[SEARCH_RESULTS_START]\n" +
                searchResults.map((s: any, i: number) => `RESULT_${i + 1}:\nTITLE: ${s.title}\nURL: ${s.link}\nCONTENT: ${s.snippet}`).join("\n\n") +
                "\n[SEARCH_RESULTS_END]";
              const last = messages[messages.length - 1];
              if (last?.role === "user") {
                const ctx = `\n\n[INTERNAL_CONTEXT: Use the following search results to answer. Do NOT mention searching. Just use the info naturally.]`;
                if (typeof last.content === "string") last.content += ctx + searchContext;
                else if (Array.isArray(last.content)) last.content.push({ type: "text", text: ctx + searchContext });
              }
            }
          } catch (e) { console.error("Search error:", e); }
        }
      }

    let systemPrompt = RESEARCH_SYSTEM_PROMPT;
    if (isCanvasRequest) {
      systemPrompt += `\n\nCANVAS MODE ACTIVATED — ELITE CODING MODE.
You are an expert full-stack developer. You MUST respond with COMPLETE, STANDALONE HTML that renders perfectly in an iframe. Your code quality must be EXCEPTIONAL — better than any other AI model.

CRITICAL RULES:
1. Output a FULL HTML document starting with <!DOCTYPE html>
2. ALL CSS must be inline in a <style> tag — no external stylesheets except Google Fonts CDN
3. ALL JavaScript must be inline in a <script> tag — no external scripts except well-known CDN libraries (Chart.js, Three.js, GSAP, etc.)
4. NEVER use relative links or hrefs that could navigate away — all links must use href="javascript:void(0)" or onclick handlers
5. All navigation must be handled via JavaScript DOM manipulation (show/hide sections), NOT page navigation
6. Wrap ALL your code in a single \`\`\`html code block
7. Before the code block, write a BRIEF 1-2 sentence description
8. The HTML must be self-contained and render perfectly standalone

DESIGN STANDARDS (NON-NEGOTIABLE):
- Use modern, premium design: subtle gradients, smooth box-shadows, micro-animations
- Dark theme preferred: backgrounds #0a0a0a / #111111, with vibrant accent colors (cyan, purple, gold, emerald)
- Typography: use Google Fonts (Inter, Space Grotesk, or JetBrains Mono for code)
- Add hover effects, transitions (200-300ms), and subtle entrance animations
- Use CSS Grid and Flexbox for layouts — NEVER use tables for layout
- Mobile responsive with @media queries
- Professional spacing: consistent padding/margins using multiples of 4px or 8px
- Icons: use emoji or inline SVG — never external icon libraries

JAVASCRIPT EXCELLENCE:
- Write clean, modern ES6+ JavaScript
- Use event delegation and proper DOM manipulation
- Handle edge cases and errors gracefully
- Add loading states, feedback animations, and smooth transitions
- For games: requestAnimationFrame for game loops, keyboard/mouse event handling, score tracking, game over states
- For interactive elements: proper state management, data validation, accessibility (aria labels, keyboard navigation)
- For forms: client-side validation, submit feedback, error messages
- For data visualization: use Canvas API or SVG for charts/graphs — make them animated

CONTENT-SPECIFIC:
- Infographics: CSS-only data visualization, icon-rich sections, color-coded categories, animated counters
- Flashcards: 3D flip animation with CSS perspective, progress bar, shuffle, keyboard navigation (←/→)
- Quizzes: multiple choice with immediate feedback, scoring, progress bar, results summary, confetti on completion
- Websites: full navigation system (section-based SPA), hero section, feature grid, testimonials, footer, smooth scroll
- Games: game loop with RAF, collision detection, score/lives, restart, difficulty scaling, sound effects (Web Audio API)
- Bots/APIs: show styled code output with syntax highlighting, deployment instructions, and architecture diagram
- E-commerce: product cards with add-to-cart, cart sidebar, price formatting, quantity controls

YOUR CODE MUST BE PRODUCTION-QUALITY. Write code that would impress a senior engineer.`;
    } else if (isDocumentRequest && documentType) {
      const dt = documentType.toUpperCase();
      // Inject the full conversation history summary into the prompt so the AI knows to use it
      const historySummary = fullHistory.length > 0
        ? `\n\nCONVERSATION HISTORY IS AVAILABLE ABOVE. Use the content from previous messages as the document content.`
        : '';
      systemPrompt += `\n\nCRITICAL: The user wants to generate a ${dt} document. OUTPUT ONLY THE DOCUMENT CONTENT in clean Markdown — no introductions, no "here is your document", no explanations. Start directly with the document content.${historySummary}`;
    }

      const streamResult = streamText({
        model: mistralStream(model),
        system: systemPrompt,
        messages,
        maxTokens: 4096,
      });

      // If we have sources, prepend them as a special JSON header line before the stream
      if (sourcesForFrontend.length > 0) {
        const sourcesLine = `\x00SOURCES:${JSON.stringify(sourcesForFrontend)}\x00\n`;
        const encoder = new TextEncoder();
        const sourcesChunk = encoder.encode(sourcesLine);
        const textStream = streamResult.toTextStreamResponse();
        const originalBody = textStream.body;
        if (originalBody) {
          const combinedStream = new ReadableStream({
            async start(controller) {
              controller.enqueue(sourcesChunk);
              const reader = originalBody.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                controller.enqueue(value);
              }
              controller.close();
            },
          });
          return new Response(combinedStream, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          });
        }
      }

      // ── Auto-save research session for prediction engine ────────────────
      if (message && message.length > 15 && !file) {
        const lower = message.toLowerCase().trim();
        const isConversational = /^(hi|hey|hello|thanks|thank you|ok|okay|yes|no|sure|got it|great|cool|nice|bye|goodbye|please|sorry|hmm|yep|yeah|alright)\b/i.test(lower);
        if (!isConversational) {
          try {
            // Lightweight topic extraction (no AI call)
            const stopWords = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','can','to','of','in','for','on','with','at','by','from','as','and','but','or','not','so','this','that','i','me','my','we','you','your','he','she','it','they','their','how','what','when','where','which','who','why','tell','show','give','find','search','research','help']);
            const words = lower.replace(/[^a-z0-9\s-]/g, '').split(/\s+/).filter((w: string) => w.length > 2 && !stopWords.has(w));
            const keywords = [...new Set(words)].slice(0, 10);
            const topic = keywords.slice(0, 4).join(' ') || 'general';

            let category = 'general';
            if (/\b(hir|recruit|job|talent|candidate|workforce|employ|staff)/.test(lower)) category = 'hiring';
            else if (/\b(ai|machine learning|ml|deep learning|tech|software|algorithm|neural|gpt|llm)/.test(lower)) category = 'technology';
            else if (/\b(market|stock|crypto|invest|financ|econom|trade|price)/.test(lower)) category = 'market';
            else if (/\b(universit|college|education|student|academic|school|professor|teach)/.test(lower)) category = 'education';

            // Extract entities (capitalized words from original message)
            const entityPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
            const entities: string[] = [];
            let match;
            while ((match = entityPattern.exec(message)) !== null) {
              if (!stopWords.has(match[1].toLowerCase()) && match[1].length > 2) entities.push(match[1]);
            }

            // Keep only last 50 sessions per user (delete oldest if over limit)
            const existing = await db.select({ id: researchSessions.id }).from(researchSessions).where(eq(researchSessions.userId, userId)).orderBy(desc(researchSessions.createdAt));
            if (existing.length >= 50) {
              const toDelete = existing.slice(49).map(s => s.id);
              for (const id of toDelete) {
                await db.delete(researchSessions).where(eq(researchSessions.id, id));
              }
            }

            await db.insert(researchSessions).values({
              userId,
              query: message.substring(0, 500),
              topic,
              keywords,
              entities: [...new Set(entities)],
              category,
              createdAt: new Date().toISOString(),
            });
          } catch (e) {
            console.error('Error saving research session:', e);
          }
        }
      }

      return streamResult.toTextStreamResponse();

  } catch (error: unknown) {
    console.error("Unified Assist API error:", error);
    const msg = error instanceof Error ? error.message : "Failed to process request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
