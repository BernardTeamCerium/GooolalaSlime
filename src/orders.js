import Stripe from 'stripe';
import { COLORS } from './catalog.js';
import { LOGO_SRC, sendEmail } from './mailer.js';
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
  if (pi) await stripe.paymentIntents.update(pi.id, { metadata: { [flag]: new Date().toISOString() } });
  return true;
}

export async function sendConfirmation(sessionId) {
  const order = await loadOrder(sessionId);
  if (order.paymentStatus !== 'paid') return false;
  return once(order, 'gooolala_confirmation_sent', async () => {
    await sendEmail({ to: order.email, ...orderConfirmationEmail(order, { logoSrc: LOGO_SRC }) });
    if (process.env.OWNER_EMAIL) {
      await sendEmail({ to: process.env.OWNER_EMAIL, replyTo: order.email, ...ownerNewOrderEmail(order) });
    }
  });
}

export async function sendPaymentFailed(sessionId) {
  const order = await loadOrder(sessionId);
  return once(order, 'gooolala_failed_sent', () =>
    sendEmail({
      to: order.email,
      ...paymentFailedEmail(order, { logoSrc: LOGO_SRC, shopUrl: `${process.env.BASE_URL || 'https://gooolala.com'}/#menu` }),
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
