// Renders every customer email with sample data into email-previews/ so you can open them in a browser.
// Usage: npm run email:preview
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { orderConfirmationEmail, orderShippedEmail, ownerNewOrderEmail, paymentFailedEmail } from '../src/emails.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(ROOT, 'email-previews');
const logoSrc = '../public/img/gooolala-logo-email.png';

const sample = {
  sessionId: 'cs_test_sample1234ABCD',
  number: '1234ABCD',
  email: 'parent@example.com',
  customerName: 'Jordan Rivera',
  firstName: 'Jordan',
  slimeFor: 'Maya',
  currency: 'usd',
  items: [
    { name: 'Queen’s Pink', hex: '#F84FB3', qty: 2, amount: 1600 },
    { name: 'Mermaid Majesty', hex: '#36D4DA', qty: 1, amount: 800 },
    { name: 'Moonlight Pearl', hex: '#E8E6F3', qty: 1, amount: 800 },
  ],
  subtotal: 3200,
  discount: 0,
  shippingAmount: 500,
  tax: 0,
  total: 3700,
  shipping: { name: 'Jordan Rivera', address: { line1: '12 Castle Lane', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } },
};

const emails = {
  'order-confirmation': orderConfirmationEmail(sample, { logoSrc }),
  'order-shipped': orderShippedEmail(sample, { logoSrc, carrier: 'USPS', trackingNumber: '9400 1000 0000 0000 0000 00', trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction' }),
  'payment-failed': paymentFailedEmail(sample, { logoSrc, shopUrl: 'https://gooolala.com/#menu' }),
  'owner-new-order': ownerNewOrderEmail(sample, { progress: { sold: 37, goal: 100 } }),
};

await fs.mkdir(out, { recursive: true });
for (const [name, email] of Object.entries(emails)) {
  await fs.writeFile(path.join(out, `${name}.html`), email.html);
  console.log(`${name}.html  —  ${email.subject}`);
}
console.log(`\nOpen the files in ${path.relative(process.cwd(), out) || out}/ to preview.`);
