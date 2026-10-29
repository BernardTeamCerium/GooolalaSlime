# Gooolala! by Aviana, the Slime Queen

A one-product landing page for **Royal Collection Slime** (10 royal colors), with Stripe Checkout and branded, personalized order emails.

- **Landing page** (`public/`): hero, color picker, "My Gooo" bag, how-it-works, Meet the Queen, Gooo Care and FAQ. Uses the brand guide palette, Trebuchet MS, pill buttons and 24px cards.
- **Checkout** (`server.js`): prices are set on the server and payment goes through Stripe's hosted Checkout page. It collects the shipping address and an optional *"Who is this gooo for?"* name, and accepts promo codes.
- **Emails** (`src/emails.js`): order confirmation, shipped (with tracking), payment failed, and a new-order alert for Aviana. Each one is personalized with the customer's name, who the slime is for, and color swatches.

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run dev
```

Open http://localhost:4242. With no Stripe key the site runs in **preview mode**: everything works except paying.

## Turn on Stripe

1. Create a Stripe account and copy your **test** secret key (`sk_test_…`) into `STRIPE_SECRET_KEY` in `.env`.
2. Forward webhooks to your machine with the [Stripe CLI](https://docs.stripe.com/stripe-cli):

   ```bash
   stripe listen --forward-to localhost:4242/api/stripe-webhook
   ```

   Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`, then restart the server.
3. Place a test order with card `4242 4242 4242 4242`, any future date and any CVC.

For production, add a webhook endpoint in the Stripe dashboard pointing to `https://YOUR-DOMAIN/api/stripe-webhook` with these events:
`checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.

## Emails

Until SMTP is configured, every email is saved as an HTML file in `email-previews/` instead of being sent. To see all the templates with sample data:

```bash
npm run email:preview
```

To send real email, fill in `SMTP_*`, `EMAIL_FROM` and `OWNER_EMAIL` in `.env`. Any SMTP provider works (Resend, Postmark, SendGrid, Google Workspace…). Use a sending domain you've verified with that provider so emails don't land in spam.

**When an order ships**, run this with the session id from the new-order email:

```bash
npm run email:shipped -- cs_live_XXXX 9400111899223456789012 USPS
```

Each email is sent at most once per order, even if Stripe retries a webhook. A flag is stored on the order's PaymentIntent in Stripe, so no database is needed.

## Settings (`.env`)

| Variable | What it does |
| --- | --- |
| `PRICE_CENTS` | Price per jar (default `800` = $8.00) |
| `SHIPPING_CENTS` | Flat shipping (default `500`) |
| `FREE_SHIPPING_FROM_CENTS` | Subtotal for free shipping (`0` = off) |
| `SHIP_COUNTRIES` | e.g. `US` or `US,CA` |
| `STRIPE_AUTOMATIC_TAX` | `true` once Stripe Tax is set up |
| `BASE_URL` | Your public URL (used for redirects and product images) |

Colors, names and descriptions live in `src/catalog.js`. Email wording lives in `src/emails.js`.

## Deploying

This is a plain Node 18+ app (`npm start`), so it runs on Render, Railway, Fly.io, Heroku and similar hosts. Set the same environment variables there, and set `BASE_URL` to the live https URL.

## Brand notes followed

- Logo artwork is never cropped, rotated, recolored or given effects, and only sits on quiet light backgrounds.
- Small text is plum on light backgrounds. Bright pink is used for big type, buttons and accents.
- Copy makes no edible, hypoallergenic or non-toxic claims, and "Do not eat" appears on the page and in every customer email.
