import Stripe from 'stripe';
import { COLORS, PRODUCT } from './catalog.js';
import { LOGO_SRC, OWNER_EMAIL, SITE_URL, sendEmail } from './mailer.js';
import { orderConfirmationEmail, orderShippedEmail, ownerNewOrderEmail, paymentFailedEmail } from './emails.js';

export const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

export const orderNumber = (sessionId) => sessionId.slice(-8).toUpperCase();

// Loads a Checkout Session from Stripe and flattens it into what the emails and thank-you page need.
export async function loadOrder(sessionId) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['line_items', 'line_items.data.price.product', 'payment_intent'],
  });
  const details = session.customer_details || {};
  const customerName = details.name || '';
  const slimeFor = session.custom_fields?.find((f) => f.key === 'slime_for')?.text?.value || '';

  const items = session.line_items.data.map((li) => {
    const colorId = li.price?.product?.metadata?.color_id;
    const color = COLORS.find((c) => c.id === colorId);
    return {
      name: color?.name || li.description,
      hex: color?.hex || '#F84FB3',
      qty: li.quantity,
      amount: li.amount_total,
    };
  });

  const shipping = session.collected_information?.shipping_details || session.shipping_details || null;

  return {
    sessionId: session.id,
    number: orderNumber(session.id),
    status: session.status,
    paymentStatus: session.payment_status,
    email: details.email,
    customerName,
    firstName: customerName.split(' ')[0] || '',
    slimeFor,
    items,
    currency: session.currency,
    subtotal: session.amount_subtotal,
    discount: session.total_details?.amount_discount || 0,
    shippingAmount: session.total_details?.amount_shipping || 0,
    tax: session.total_details?.amount_tax || 0,
    total: session.amount_total,
    shipping,
    paymentIntent: typeof session.payment_intent === 'object' ? session.payment_intent : null,
  };
}

// Stripe can deliver the same webhook more than once; a flag on the PaymentIntent
// makes sure each email only goes out once.
async function once(order, flag, fn) {
  const pi = order.paymentIntent;
  if (pi?.metadata?.[flag]) return false;
  await fn();
  if (pi) pi.metadata = (await stripe.paymentIntents.update(pi.id, { metadata: { [flag]: new Date().toISOString() } })).metadata;
  return true;
}

// Counts jars sold by adding up every paid Checkout Session for this product.
// Stripe is the record of sales, so there's no separate database to keep in sync.
let cache = { at: 0, sold: 0 };
export async function salesProgress() {
  if (Date.now() - cache.at < 30_000) return cache.sold;
  let sold = 0;
  for await (const s of stripe.checkout.sessions.list({ status: 'complete', limit: 100, expand: ['data.line_items'] })) {
    if (s.payment_status !== 'paid' || s.metadata?.product_id !== PRODUCT.id) continue;
    sold += s.line_items?.data.reduce((n, li) => n + li.quantity, 0) || 0;
  }
  cache = { at: Date.now(), sold };
  return sold;
}

export async function sendConfirmation(sessionId) {
  const order = await loadOrder(sessionId);
  if (order.paymentStatus !== 'paid') return false;
  // Separate flags, so a Stripe retry after one email fails never re-sends the other.
  const sent = await once(order, 'gooolala_confirmation_sent', () =>
    sendEmail({ to: order.email, ...orderConfirmationEmail(order, { logoSrc: LOGO_SRC }) })
  );
  await once(order, 'gooolala_owner_alert_sent', async () => {
    cache.at = 0; // include this order in the count
    const progress = await salesProgress().then((sold) => ({ sold, goal: PRODUCT.salesGoal }), () => null);
    await sendEmail({ to: OWNER_EMAIL, replyTo: order.email, ...ownerNewOrderEmail(order, { progress }) });
  });
  return sent;
}

export async function sendPaymentFailed(sessionId) {
  const order = await loadOrder(sessionId);
  return once(order, 'gooolala_failed_sent', () =>
    sendEmail({
      to: order.email,
      ...paymentFailedEmail(order, { logoSrc: LOGO_SRC, shopUrl: `${SITE_URL}/#menu` }),
    })
  );
}

export async function sendShipped(sessionId, { trackingNumber, carrier, trackingUrl } = {}) {
  const order = await loadOrder(sessionId);
  if (order.paymentStatus !== 'paid') throw new Error(`Order ${order.number} is not paid (status: ${order.paymentStatus}).`);
  return once(order, 'gooolala_shipped_sent', () =>
    sendEmail({ to: order.email, ...orderShippedEmail(order, { logoSrc: LOGO_SRC, trackingNumber, carrier, trackingUrl }) })
  );
}
