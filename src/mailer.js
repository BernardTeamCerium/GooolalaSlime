import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOGO_PATH = path.join(ROOT, 'public/img/gooolala-logo-email.png');
const LOGO_CID = 'gooolala-logo@gooolala';
const PREVIEW_DIR = path.join(ROOT, 'email-previews');

// Emails reference the logo as an inline attachment so it shows up even before the site is live.
export const LOGO_SRC = `cid:${LOGO_CID}`;

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

// Sends through SMTP when configured; otherwise saves the email as an .html file
// in email-previews/ so you can see exactly what customers would get.
export async function sendEmail({ to, subject, html, text, replyTo }) {
  const t = getTransport();
  if (!t) {
    await fs.mkdir(PREVIEW_DIR, { recursive: true });
    const file = path.join(PREVIEW_DIR, `${Date.now()}-${subject.replace(/[^a-z0-9]+/gi, '-').slice(0, 60)}.html`);
    await fs.writeFile(file, html.replaceAll(LOGO_SRC, '../public/img/gooolala-logo-email.png'));
    console.log(`[email] SMTP not configured. Saved "${subject}" for ${to} → ${path.relative(ROOT, file)}`);
    return { preview: file };
  }
  return t.sendMail({
    from: process.env.EMAIL_FROM || 'Gooolala! <hello@gooolala.com>',
    to,
    replyTo: replyTo || process.env.EMAIL_REPLY_TO || undefined,
    subject,
    html,
    text,
    attachments: html.includes(LOGO_SRC) ? [{ filename: 'gooolala.png', path: LOGO_PATH, cid: LOGO_CID }] : [],
  });
}
