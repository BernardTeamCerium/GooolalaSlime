// All /api/* routes as one Web-standard handler: (Request) => Response.
// Netlify runs it as a function (netlify/functions/api.mjs); server.js runs it locally.
import { COLORS, PRODUCT, validateCart } from './catalog.js';
import { loadOrder, salesProgress, sendConfirmation, sendPaymentFailed, stripe } from './orders.js';

const SHIPPING_CENTS = Number(process.env.SHIPPING_CENTS ?? 500);
const FREE_SHIPPING_FROM_CENTS = Number(process.env.FREE_SHIPPING_FROM_CENTS || 0);
const SHIP_COUNTRIES = (process.env.SHIP_COUNTRIES || 'US').split(',').map((c) => c.trim().toUpperCase());
const AUTOMATIC_TAX = process.env.STRIPE_AUTOMATIC_TAX !== 'false';
const MAKE_DAYS = Number(process.env.MAKE_DAYS || 3);
const TRANSIT_DAYS = { min: Number(process.env.TRANSIT_DAYS_MIN || 2), max: Number(process.env.TRANSIT_DAYS_MAX || 5) };

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export async function handleApi(req) {
  const url = new URL(req.url);
  const route = `${req.method} ${url.pathname.replace(/\/$/, '')}`;

  if (route === 'POST /api/stripe-webhook') return webhook(req);
  if (route === 'GET /api/config') return config();
  if (route === 'GET /api/progress') return progress();
  if (route === 'POST /api/checkout') return checkout(req, url);
  const order = url.pathname.match(/^\/api\/order\/([^/]+)$/);
  if (req.method === 'GET' && order) return orderSummary(order[1]);
  return json({ error: 'Not found' }, 404);
}

function config() {
  return json({
    product: {
      name: PRODUCT.name,
      tagline: PRODUCT.tagline,
      description: PRODUCT.description,
      unitAmount: PRODUCT.unitAmount,
      currency: PRODUCT.currency,
      maxPerColor: PRODUCT.maxPerColor,
      maxPerOrder: PRODUCT.maxPerOrder,
      salesGoal: PRODUCT.salesGoal,
      makeDays: MAKE_DAYS,
    },
    colors: COLORS,
    shipping: { amount: SHIPPING_CENTS, freeFrom: FREE_SHIPPING_FROM_CENTS },
    taxAtCheckout: AUTOMATIC_TAX,
    checkoutEnabled: Boolean(stripe),
  });
}

// Jars sold toward the sales goal. The CDN caches it for a minute so page views don't hammer Stripe.
async function progress() {
  if (!stripe) return json({ sold: 0, goal: PRODUCT.salesGoal });
  try {
    const sold = await salesProgress();
    return json({ sold, goal: PRODUCT.salesGoal }, 200, {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    });
  } catch (err) {
    console.error('[progress]', err);
    return json({ error: 'Could not count sales' }, 502);
  }
}

async function checkout(req, url) {
  let cart;
  try {
    cart = validateCart((await req.json())?.items);
  } catch (err) {
    return json({ error: err instanceof SyntaxError ? 'Bad request' : err.message }, 400);
  }
  if (!stripe) return json({ error: 'Checkout is in preview mode. Add your Stripe keys to turn on real orders.' }, 503);

  // Redirect back to whichever address the shopper is on (live site, deploy preview or localhost).
  const origin = url.origin;
  const subtotal = cart.reduce((sum, i) => sum + i.qty * PRODUCT.unitAmount, 0);
  const freeShipping = SHIPPING_CENTS === 0 || (FREE_SHIPPING_FROM_CENTS > 0 && subtotal >= FREE_SHIPPING_FROM_CENTS);
  // Stripe only shows product images it can fetch, so skip them while running on localhost.
  const images = origin.startsWith('https://') ? [`${origin}/img/jar-label.webp`] : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cart.map(({ color, qty }) => ({
        quantity: qty,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: PRODUCT.unitAmount,
          tax_behavior: 'exclusive',
          product_data: {
            name: `${PRODUCT.name} — ${color.name}`,
            description: color.blurb,
            images,
            tax_code: PRODUCT.taxCode,
            metadata: { product_id: PRODUCT.id, color_id: color.id },
          },
        },
      })),
      shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: freeShipping ? 'Free royal shipping' : 'Royal mail',
            type: 'fixed_amount',
            fixed_amount: { amount: freeShipping ? 0 : SHIPPING_CENTS, currency: PRODUCT.currency },
            tax_behavior: 'exclusive',
            tax_code: 'txcd_92010001', // Stripe's tax code for shipping charges
            // Made to order, so the estimate covers making time plus time in the mail.
            delivery_estimate: {
              minimum: { unit: 'business_day', value: MAKE_DAYS + TRANSIT_DAYS.min },
              maximum: { unit: 'business_day', value: MAKE_DAYS + TRANSIT_DAYS.max },
            },
          },
        },
      ],
      automatic_tax: { enabled: AUTOMATIC_TAX },
      custom_fields: [
        {
          key: 'slime_for',
          label: { type: 'custom', custom: 'Who is this gooo for? (first name)' },
          type: 'text',
          optional: true,
          text: { maximum_length: 40 },
        },
      ],
      custom_text: {
        shipping_address: { message: `Every jar is made to order. Aviana needs about ${MAKE_DAYS} days to make it before it ships.` },
        submit: { message: 'Grown-ups, please complete checkout. We’ll email order updates to the address above.' },
      },
      allow_promotion_codes: true,
      metadata: { product_id: PRODUCT.id, cart: cart.map((i) => `${i.color.id}:${i.qty}`).join(',') },
      success_url: `${origin}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?canceled=1#menu`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err);
    return json({ error: 'We couldn’t open checkout. Please try again in a moment.' }, 500);
  }
}

// Order summary for the thank-you page. Session ids are long and unguessable, and we only return
// what the customer just saw at checkout (no address or email).
async function orderSummary(sessionId) {
  if (!stripe) return json({ error: 'Stripe is not configured' }, 503);
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return json({ error: 'Bad order id' }, 400);
  try {
    const o = await loadOrder(sessionId);
    return json({
      number: o.number,
      paid: o.paymentStatus === 'paid',
      firstName: o.firstName,
      slimeFor: o.slimeFor,
      items: o.items,
      total: o.total,
      currency: o.currency,
    });
  } catch {
    return json({ error: 'Order not found' }, 404);
  }
}

async function webhook(req) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return new Response('Stripe is not configured', { status: 503 });
  let event;
  try {
    // Signature checks need the exact raw body Stripe sent.
    event = stripe.webhooks.constructEvent(await req.text(), req.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook signature error: ${err.message}`, { status: 400 });
  }
  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await sendConfirmation(event.data.object.id);
        break;
      case 'checkout.session.async_payment_failed':
        await sendPaymentFailed(event.data.object.id);
        break;
    }
    return json({ received: true });
  } catch (err) {
    // A 500 tells Stripe to retry later, so a hiccup with the email provider doesn't lose the email.
    console.error(`[webhook] ${event.type} failed:`, err);
    return new Response('Webhook handler failed', { status: 500 });
  }
}
