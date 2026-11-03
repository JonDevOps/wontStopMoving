/**
 * Unified Transactional Email Service for Wont Stop Moving
 *
 * Supports:
 * 1. Amazon SES (Recommended for automated transactional emails: 6-digit Escrow Release Codes, Quote Proposals, Dispatch Alerts)
 * 2. Zoho Mail $1 Tier / Cloudflare Email Routing (Recommended for human business inboxes & aliases: support@, dispatch@, quotes@, admin@wontstopmoving.com)
 */

export interface TransactionalEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  category?: "escrow_code" | "quote_proposal" | "dispatch_alert" | "general";
}

export function getEmailProviderConfig() {
  const sesHost = process.env.AWS_SES_SMTP_HOST || "";
  const sesUser = process.env.AWS_SES_SMTP_USER || "";
  const sesPass = process.env.AWS_SES_SMTP_PASS || "";

  const zohoUser = process.env.ZOHO_SMTP_USER || "";
  const zohoPass = process.env.ZOHO_SMTP_PASS || "";

  const fromAddress =
    process.env.EMAIL_FROM_ADDRESS || "Wont Stop Moving <quotes@wontstopmoving.com>";
  const replyToAddress =
    process.env.EMAIL_REPLY_TO || "support@wontstopmoving.com";

  if (sesHost && sesUser && sesPass) {
    return {
      provider: "amazon_ses" as const,
      configured: true,
      host: sesHost,
      port: Number(process.env.AWS_SES_SMTP_PORT || 587),
      user: sesUser,
      from: fromAddress,
      replyTo: replyToAddress,
    };
  }

  if (zohoUser && zohoPass) {
    return {
      provider: "zoho_mail" as const,
      configured: true,
      host: process.env.ZOHO_SMTP_HOST || "smtppro.zoho.com",
      port: Number(process.env.ZOHO_SMTP_PORT || 465),
      user: zohoUser,
      from: fromAddress,
      replyTo: replyToAddress,
    };
  }

  return {
    provider: "pending_setup" as const,
    configured: false,
    from: fromAddress,
    replyTo: replyToAddress,
  };
}

export function buildEscrowReleaseCodeEmail(params: {
  customerName: string;
  jobId: string;
  moveDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  price: number;
  releaseCode: string;
}): { subject: string; html: string; text: string } {
  const subject = `Your Move is Confirmed! 6-Digit Escrow Release Code: ${params.releaseCode}`;
  const text = [
    `Hi ${params.customerName || "Valued Customer"},`,
    ``,
    `Your relocation with Wont Stop Moving is confirmed and protected in escrow ($${params.price.toLocaleString()}).`,
    ``,
    `IMPORTANT — YOUR 6-DIGIT ESCROW RELEASE CODE: ${params.releaseCode}`,
    `Do not share this code until your move is complete and all items are unloaded to your satisfaction.`,
    ``,
    `Move Details:`,
    `- Job ID: ${params.jobId}`,
    `- Move Date: ${params.moveDate}`,
    `- Pickup: ${params.pickupAddress}`,
    `- Drop-off: ${params.dropoffAddress}`,
    ``,
    `Questions? Reply directly to this email or call (650) 569-0584.`,
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px;">
      <h2 style="color: #0f172a; margin-top: 0;">Move Confirmed & Protected in Escrow</h2>
      <p style="color: #475569;">Hi ${params.customerName || "Valued Customer"},</p>
      <p style="color: #475569;">Your payment of <strong>$${params.price.toLocaleString()}</strong> is securely held in escrow. Give the 6-digit release code below to your moving crew leader <strong>only after</strong> your move is completed.</p>
      <div style="background: #0f172a; color: #ffffff; padding: 20px; border-radius: 12px; text-align: center; margin: 24px 0;">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8;">6-Digit Escrow Release Code</div>
        <div style="font-size: 36px; font-weight: 900; letter-spacing: 6px; margin-top: 8px; color: #38bdf8;">${params.releaseCode}</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">
        <strong>Job ID:</strong> ${params.jobId}<br/>
        <strong>Move Date:</strong> ${params.moveDate}<br/>
        <strong>Pickup:</strong> ${params.pickupAddress}<br/>
        <strong>Drop-off:</strong> ${params.dropoffAddress}
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
      <p style="font-size: 12px; color: #94a3b8;">Wont Stop Moving • Nationwide Relocation & Logistics • (650) 569-0584</p>
    </div>
  `;

  return { subject, html, text };
}

