import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { COLORS, PRODUCT, validateCart } from './src/catalog.js';
import { loadOrder, sendConfirmation, sendPaymentFailed, stripe } from './src/orders.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4242);
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SHIPPING_CENTS = Number(process.env.SHIPPING_CENTS ?? 500);
const FREE_SHIPPING_FROM_CENTS = Number(process.env.FREE_SHIPPING_FROM_CENTS || 0);
const SHIP_COUNTRIES = (process.env.SHIP_COUNTRIES || 'US').split(',').map((c) => c.trim().toUpperCase());

const app = express();

// Stripe webhooks need the raw body for signature checks, so this route comes before express.json().
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe is not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature error: ${err.message}`);
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
    res.json({ received: true });
  } catch (err) {
    // A 500 tells Stripe to retry later, so a hiccup with the email provider doesn't lose the email.
    console.error(`[webhook] ${event.type} failed:`, err);
    res.status(500).send('Webhook handler failed');
  }
});

app.use(express.json({ limit: '20kb' }));

app.get('/api/config', (_req, res) => {
  res.json({
    product: {
      name: PRODUCT.name,
      tagline: PRODUCT.tagline,
      description: PRODUCT.description,
      unitAmount: PRODUCT.unitAmount,
      currency: PRODUCT.currency,
      maxPerColor: PRODUCT.maxPerColor,
      maxPerOrder: PRODUCT.maxPerOrder,
    },
    colors: COLORS,
    shipping: { amount: SHIPPING_CENTS, freeFrom: FREE_SHIPPING_FROM_CENTS },
    checkoutEnabled: Boolean(stripe),
  });
});

app.post('/api/checkout', async (req, res) => {
  let cart;
  try {
    cart = validateCart(req.body?.items);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!stripe) {
    return res.status(503).json({ error: 'Checkout is in preview mode. Add your Stripe keys to turn on real orders.' });
  }

  const subtotal = cart.reduce((sum, i) => sum + i.qty * PRODUCT.unitAmount, 0);
  const freeShipping = SHIPPING_CENTS === 0 || (FREE_SHIPPING_FROM_CENTS > 0 && subtotal >= FREE_SHIPPING_FROM_CENTS);
  // Stripe only shows product images it can fetch, so skip them while running on localhost.
  const images = BASE_URL.startsWith('https://') ? [`${BASE_URL}/img/jar-label.webp`] : undefined;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: cart.map(({ color, qty }) => ({
        quantity: qty,
        price_data: {
          currency: PRODUCT.currency,
          unit_amount: PRODUCT.unitAmount,
          product_data: {
            name: `${PRODUCT.name} — ${color.name}`,
            description: color.blurb,
            images,
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
            delivery_estimate: { minimum: { unit: 'business_day', value: 3 }, maximum: { unit: 'business_day', value: 7 } },
          },
        },
      ],
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
        submit: { message: 'Grown-ups, please complete checkout. We’ll email order updates to the address above.' },
      },
      allow_promotion_codes: true,
      automatic_tax: { enabled: process.env.STRIPE_AUTOMATIC_TAX === 'true' },
      metadata: { cart: cart.map((i) => `${i.color.id}:${i.qty}`).join(',') },
      success_url: `${BASE_URL}/thank-you.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/?canceled=1#menu`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[checkout]', err);
    res.status(500).json({ error: 'We couldn’t open checkout. Please try again in a moment.' });
  }
});

// Order summary for the thank-you page. Session ids are long and unguessable, and we only return
// what the customer just saw at checkout (no address or email).
app.get('/api/order/:sessionId', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(req.params.sessionId)) return res.status(400).json({ error: 'Bad order id' });
  try {
    const o = await loadOrder(req.params.sessionId);
    res.json({
      number: o.number,
      paid: o.paymentStatus === 'paid',
      firstName: o.firstName,
      slimeFor: o.slimeFor,
      items: o.items,
      total: o.total,
      currency: o.currency,
    });
  } catch {
    res.status(404).json({ error: 'Order not found' });
  }
});

app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`👑 Gooolala is live at ${BASE_URL}`);
  if (!stripe) console.log('   Preview mode: set STRIPE_SECRET_KEY in .env to take real orders.');
  if (!process.env.SMTP_HOST) console.log('   Emails are saved to email-previews/ until SMTP_* is set in .env.');
});
