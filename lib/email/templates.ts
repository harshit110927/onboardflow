const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL as string;

export function buildEmailHtml(options: {
  body: string;
  campaignId?: number;
  contactEmail?: string;
  unsubscribeToken?: string;
  senderEmail?: string;
  trackingPixelUrl?: string;
}): string {
  const { body, unsubscribeToken, contactEmail, senderEmail, trackingPixelUrl } = options;

  const appUrl = BASE_URL || "https://www.onboardflow.xyz";
  const unsubscribeUrl = unsubscribeToken && contactEmail
    ? `${appUrl}/unsubscribe?token=${unsubscribeToken}&email=${encodeURIComponent(contactEmail)}`
    : `${appUrl}/unsubscribe`;

  // FIX — support both plain-text and HTML email body formats for better output fidelity
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const escapedBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const htmlBody = hasHtml
    ? body
    : escapedBody
        .split("\n")
        .map((line) => line.trim() ? `<p style="margin:0 0 12px 0;">${line}</p>` : "")
        .join("");
  const fromLabel = senderEmail ?? "OnboardFlow";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#1e1b4b;padding:24px 32px;border-radius:12px 12px 0 0;">
              <span style="font-size:16px;font-weight:600;color:#e0e7ff;letter-spacing:-0.3px;">${fromLabel}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
              <div style="font-size:15px;line-height:1.7;color:#374151;">
                ${htmlBody}
              </div>
              ${trackingPixelUrl ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:block;opacity:0;width:1px;height:1px;border:0;" />` : ""}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6;padding:20px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                Sent via ${fromLabel}.<br />
                <a href="${unsubscribeUrl}" style="color:#6366f1;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${appUrl}/privacy" style="color:#6366f1;text-decoration:underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function createUnsubscribeToken(email: string): string {
  const crypto = require("crypto");
  const secret = process.env.TRACKING_HMAC_SECRET as string;
  return crypto
    .createHmac("sha256", secret)
    .update(`unsub:${email}`)
    .digest("hex")
    .slice(0, 32);
}
