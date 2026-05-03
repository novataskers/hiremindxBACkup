import nodemailer from "nodemailer";

export type HireMindXEmailNotificationVariant =
  | "message"
  | "contract_offer"
  | "contract_response"
  | "general_notification"
  | "job_alert";

export interface HireMindXEmailNotificationMetadataItem {
  label: string;
  value: string;
}

export interface HireMindXEmailNotificationParams {
  to: string;
  subject: string;
  variant: HireMindXEmailNotificationVariant;
  title: string;
  summary: string;
  previewText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  recipientName?: string | null;
  metadata?: HireMindXEmailNotificationMetadataItem[];
}

export interface HireMindXRenderedEmailTemplate {
  html: string;
  text: string;
  subject: string;
  previewText: string;
}

export interface HireMindXEmailSendResult {
  success: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
}

interface HireMindXSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  siteUrl: string;
}

const DEFAULT_FROM_EMAIL = "info@atlasinfrastructuregroup.com";
const DEFAULT_FROM_NAME = "HireMindX Notifications";
const DEFAULT_SITE_URL = "http://localhost:3000";

function parseBoolean(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return ["true", "1", "yes", "on"].includes(value.toLowerCase());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return character;
    }
  });
}

function normalizeSiteUrl(siteUrl: string) {
  return siteUrl.replace(/\/$/, "");
}

function resolveUrl(pathOrUrl: string | undefined, siteUrl: string) {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedBase = normalizeSiteUrl(siteUrl);
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getVariantAccent(variant: HireMindXEmailNotificationVariant) {
  switch (variant) {
    case "message":
      return "#D4AF37"; // Gold
    case "contract_offer":
      return "#4ADE80"; // Bright Green
    case "contract_response":
      return "#60A5FA"; // Bright Blue
    case "job_alert":
      return "#F472B6"; // Pink
    case "general_notification":
    default:
      return "#D4AF37";
  }
}

function getSiteUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    DEFAULT_SITE_URL;

  if (!url.startsWith("http")) {
    url = `https://${url}`;
  }
  return normalizeSiteUrl(url);
}

function getSmtpConfig(): HireMindXSmtpConfig {
  const host = process.env.SMTP_HOST || process.env.HOSTINGER_SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || process.env.HOSTINGER_SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.HOSTINGER_SMTP_USER || process.env.HOSTINGER_EMAIL;
  const pass = process.env.SMTP_PASS || process.env.HOSTINGER_SMTP_PASS || process.env.HOSTINGER_EMAIL_PASSWORD;
  const fromEmail =
    process.env.NOTIFICATION_FROM_EMAIL ||
    process.env.HOSTINGER_FROM_EMAIL ||
    user ||
    DEFAULT_FROM_EMAIL;
  const fromName =
    process.env.NOTIFICATION_FROM_NAME ||
    process.env.HOSTINGER_FROM_NAME ||
    DEFAULT_FROM_NAME;

  return {
    host,
    port: Number.isNaN(port) ? 587 : port,
    secure: parseBoolean(process.env.SMTP_SECURE || process.env.HOSTINGER_SMTP_SECURE, false),
    user,
    pass,
    fromEmail,
    fromName,
    replyTo: process.env.NOTIFICATION_REPLY_TO || process.env.HOSTINGER_REPLY_TO || fromEmail,
    siteUrl: getSiteUrl(),
  };
}

export function getHireMindXNotificationBaseUrl() {
  return resolveUrl("/community", getSmtpConfig().siteUrl) as string;
}

export function renderHireMindXEmailTemplate(
  params: HireMindXEmailNotificationParams,
): HireMindXRenderedEmailTemplate {
  const config = getSmtpConfig();
  const accent = getVariantAccent(params.variant);
  const ctaUrl = resolveUrl(params.ctaUrl, config.siteUrl);
  const previewText = params.previewText || params.summary;
  const safeTitle = escapeHtml(params.title);
  const safeSummary = escapeHtml(params.summary);
  const safeRecipientName = params.recipientName ? escapeHtml(params.recipientName) : "there";
  
  const siteUrl = config.siteUrl; // Already normalized with https
  const logoUrl = `${siteUrl}/email-logo.png`;

  const metadataHtml = params.metadata?.length
    ? params.metadata
        .map(
          (item, index) => `
            <tr>
              <td style="padding: 16px; color: #888888; font-size: 14px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: ${
                index !== params.metadata!.length - 1 ? "1px solid #2A2A2A" : "none"
              };">${escapeHtml(item.label)}</td>
              <td align="right" style="padding: 16px; color: #FFFFFF; font-size: 15px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; border-bottom: ${
                index !== params.metadata!.length - 1 ? "1px solid #2A2A2A" : "none"
              };">${escapeHtml(item.value)}</td>
            </tr>`,
        )
        .join("")
    : "";

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
  <style type="text/css">
    body { margin: 0; padding: 0; background-color: #050505; -webkit-font-smoothing: antialiased; }
    img { border: 0; display: block; outline: none; text-decoration: none; }
    p { margin: 0 0 16px 0; }
    a { color: ${accent}; text-decoration: none; }
    a:hover { text-decoration: underline !important; }
    .email-container { width: 100%; max-width: 600px; margin: 0 auto; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .content-card { padding: 32px 20px !important; }
      .header-pad { padding: 40px 20px 30px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #050505; color: #E0E0E0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text -->
  <div style="display: none; font-size: 1px; color: #050505; line-height: 1px; max-height: 0; max-width: 0; opacity: 0; overflow: hidden;">
    ${escapeHtml(previewText)}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #050505;">
    <tr>
      <td align="center" style="padding: 20px 0 60px 0;">
        <table border="0" cellpadding="0" cellspacing="0" class="email-container" style="max-width: 600px; width: 600px; margin: 0 auto;">
          
          <!-- Header (Logo) -->
          <tr>
            <td align="center" class="header-pad" style="padding: 40px 0 30px 0;">
              <a href="${escapeHtml(siteUrl)}" style="display: inline-block;">
                <img src="${escapeHtml(logoUrl)}" alt="HireMindX" width="180" style="width: 180px; max-width: 100%; height: auto; display: block;" />
              </a>
            </td>
          </tr>

          <!-- Main Card -->
          <tr>
            <td align="center" style="padding: 0 16px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #111111; border: 1px solid #222222; border-radius: 12px; overflow: hidden;">
                <!-- Decorative top border -->
                <tr>
                  <td style="background-color: ${accent}; height: 4px; font-size: 0; line-height: 0;">&nbsp;</td>
                </tr>
                
                <tr>
                  <td class="content-card" style="padding: 48px 40px;">
                    
                    <h1 style="margin: 0 0 24px 0; font-size: 24px; line-height: 1.3; font-weight: 600; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      ${safeTitle}
                    </h1>

                    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #B3B3B3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      Hello ${safeRecipientName},
                    </p>

                    <p style="margin: 0 0 32px 0; font-size: 16px; line-height: 1.6; color: #CCCCCC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                      ${safeSummary}
                    </p>

                    ${
                      metadataHtml
                        ? `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 0 0 32px 0; background-color: #1A1A1A; border: 1px solid #2A2A2A; border-radius: 8px;">
                      ${metadataHtml}
                    </table>`
                        : ""
                    }

                    ${
                      ctaUrl && params.ctaLabel
                        ? `<table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center" style="padding-top: 16px;">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td align="center" bgcolor="${accent}" style="border-radius: 6px;">
                                <a href="${escapeHtml(ctaUrl)}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #000000; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; letter-spacing: 0.2px;">
                                  ${escapeHtml(params.ctaLabel)}
                                </a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>`
                        : ""
                    }
                    
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 32px 16px 0 16px;">
              <p style="margin: 0 0 12px 0; font-size: 14px; color: #666666; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                Sent securely by <strong style="color: #888888; font-weight: 600;">HireMindX</strong>
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #555555; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
                &copy; ${new Date().getFullYear()} Atlas Infrastructure Group.<br/>
                This is an automated notification. Please do not reply to this email.<br/>
                <br/>
                <a href="${escapeHtml(siteUrl)}" style="color: ${accent}; text-decoration: none;">Visit HireMindX</a> &bull; <a href="mailto:${escapeHtml(config.fromEmail)}" style="color: #555555; text-decoration: underline;">Contact Support</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "HireMindX",
    "",
    `Hello ${params.recipientName || "there"},`,
    "",
    params.title,
    params.summary,
    "",
    ...(params.metadata?.length ? params.metadata.map((item) => `${item.label}: ${item.value}`) : []),
    ...(ctaUrl && params.ctaLabel ? ["", `${params.ctaLabel}: ${ctaUrl}`] : []),
    "",
    "This transactional notification was sent by HireMindX.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    html,
    text,
    subject: params.subject,
    previewText,
  };
}

export async function sendHireMindXEmailNotification(
  params: HireMindXEmailNotificationParams,
): Promise<HireMindXEmailSendResult> {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass) {
    console.warn("[HireMindX email] SMTP is not fully configured. Skipping email send.", {
      hostConfigured: Boolean(config.host),
      userConfigured: Boolean(config.user),
      passConfigured: Boolean(config.pass),
      to: params.to,
      variant: params.variant,
    });

    return {
      success: false,
      skipped: true,
      error: "SMTP is not fully configured",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const rendered = renderHireMindXEmailTemplate(params);
    const info = await transporter.sendMail({
      from: `${config.fromName} <${config.fromEmail}>`,
      replyTo: config.replyTo,
      to: params.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("[HireMindX email] Failed to send notification email", {
      error,
      to: params.to,
      variant: params.variant,
      subject: params.subject,
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown email send error",
    };
  }
}

export default sendHireMindXEmailNotification;
