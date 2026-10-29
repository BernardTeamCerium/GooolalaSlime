import fs from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';

export const FROM = process.env.EMAIL_FROM || 'Gooolala! <hello@gooolala.com>';
export const OWNER_EMAIL = process.env.OWNER_EMAIL || 'hello@gooolala.com';

// The public site address. Netlify sets URL automatically; BASE_URL overrides it.
export const SITE_URL = (process.env.BASE_URL || process.env.URL || 'https://gooolala.com').replace(/\/$/, '');

// Emails load the logo from the live site, so it must be a public https address to show in inboxes.
export const LOGO_SRC = `${SITE_URL.startsWith('https://') ? SITE_URL : 'https://gooolala.com'}/img/gooolala-logo-email.png`;

let transport;
function getTransport() {
  if (!process.env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

// Sends through SMTP when configured. Otherwise (local testing) saves the email as an .html file
// in email-previews/ so you can see exactly what customers would get.
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const t = getTransport();
  if (t) {
    return t.sendMail({ from: FROM, to, replyTo: replyTo || process.env.EMAIL_REPLY_TO || undefined, subject, html, text });
  }
  try {
    const dir = path.resolve('email-previews');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.html`);
    await fs.writeFile(file, html);
    console.log(`[email] SMTP not configured. Saved "${subject}" for ${to} → ${file}`);
  } catch {
    console.log(`[email] SMTP not configured. Would have sent "${subject}" to ${to}`);
  }
  return null;
}
