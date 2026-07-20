import nodemailer, { type Transporter } from 'nodemailer';

/**
 * SMTP delivery for transactional mail (purchase receipts + owner sale alerts).
 * Mirrors the WhatsApp helper's contract: never throws, always reports outcome,
 * so a mail outage can never fail a payment webhook.
 *
 * Config is env-only (see .env.example): SMTP_HOST, SMTP_PORT, SMTP_USER,
 * SMTP_PASSWORD, SMTP_FROM. When SMTP_HOST is unset, sending is a no-op —
 * the feature stays dormant rather than erroring on installs without mail.
 */

export type MailResult = { ok: true } | { ok: false; error: string };

let cached: Transporter | null = null;

function transport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASSWORD ?? '',
    },
  });
  return cached;
}

/** Addresses we synthesise for buyers who paid without giving an email. */
export function isRealEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e || e.endsWith('@kursim.local')) return false;
  return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(e);
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}): Promise<MailResult> {
  const t = transport();
  if (!t) return { ok: false, error: 'smtp_not_configured' };
  if (!isRealEmail(opts.to)) return { ok: false, error: 'invalid_recipient' };
  try {
    await t.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'send_failed' };
  }
}
