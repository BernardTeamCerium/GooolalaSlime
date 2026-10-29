// Sends the "your gooo has shipped" email for an order.
// Usage: npm run email:shipped -- <checkout_session_id> [tracking-number] [carrier]
// The session id is in the new-order email Aviana receives, and in the Stripe dashboard.
import 'dotenv/config';
import { sendShipped, stripe } from '../src/orders.js';

const [sessionId, trackingNumber, carrier = 'USPS'] = process.argv.slice(2);
if (!sessionId) {
  console.error('Usage: npm run email:shipped -- <checkout_session_id> [tracking-number] [carrier]');
  process.exit(1);
}
if (!stripe) {
  console.error('Set STRIPE_SECRET_KEY in .env first.');
  process.exit(1);
}

const TRACKING_URLS = {
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${n}`,
  fedex: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
};
const clean = trackingNumber?.replace(/\s+/g, '');
const trackingUrl = clean && TRACKING_URLS[carrier.toLowerCase()]?.(encodeURIComponent(clean));

const sent = await sendShipped(sessionId, { trackingNumber, carrier, trackingUrl });
console.log(sent ? 'Shipped email sent! 🚚' : 'The shipped email was already sent for this order, so nothing was sent again.');
