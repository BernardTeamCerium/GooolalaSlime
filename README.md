# Gooolala! by Aviana, the Slime Queen

A one-product landing page for **Royal Collection Slime** ($8 a jar, 10 royal colors), hosted on Netlify. It uses Stripe Checkout with sales tax, sends branded order emails from hello@gooolala.com, and shows a Royal Goal tracker for the first 100 jars.

- **Landing page** (`public/`): hero, color picker, "My Gooo" bag, Royal Goal tracker, how-it-works, Meet the Queen, Gooo Care and FAQ.
- **API** (`src/api.js`): runs as a single Netlify Function at `/api/*` (`netlify/functions/api.mjs`).
- **Checkout**: Stripe's hosted page with $5 flat shipping and sales tax based on the buyer's address (Stripe Tax). It also asks *"Who is this gooo for?"*, and the delivery estimate includes the 3 days it takes to make an order.
- **Emails** (`src/emails.js`):
  - order confirmation, shipped (with tracking) and payment failed, sent to the customer
  - a new-order alert to hello@gooolala.com with a "make by" date and goal progress
- **Royal Goal**: counts paid jars straight from Stripe, so there's no database. Sales are monitored in the Stripe dashboard.

## 1. Set up Stripe

1. In the [Stripe dashboard](https://dashboard.stripe.com), copy your secret key (start with test mode: `sk_test_…`).
2. **Turn on Stripe Tax**: go to *Tax → Settings*, add your origin (business) address, and add registrations for the states where you collect tax. Stripe only charges tax where you're registered.
3. After the first deploy (step 2), add a webhook under *Developers → Webhooks*:
   - URL: `https://gooolala.com/api/stripe-webhook`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Copy its signing secret (`whsec_…`).

## 2. Deploy on Netlify

1. In Netlify, choose *Add new site → Import an existing project* and pick this repository. `netlify.toml` already has the settings: no build command, publish `public/`, functions in `netlify/functions/`.
2. Under *Site configuration → Environment variables*, add:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_…` (switch to `sk_live_…` at launch) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the webhook |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | From your email provider |

   Everything else has the right default: $8 price, $5 shipping, 3 make days, 100-jar goal, tax on, and emails from and to hello@gooolala.com. See `.env.example` to change any of them.
3. Connect the gooolala.com domain under *Domain management*.

When you switch from test to live keys, create a new webhook in live mode and update `STRIPE_WEBHOOK_SECRET` too.

## 3. Email from hello@gooolala.com

Any SMTP provider works (Resend, Postmark, SendGrid, Google Workspace…). Verify the **gooolala.com** domain with that provider (it gives you DNS records to add) so emails don't land in spam.

**When an order ships**, run this on your computer with Stripe and SMTP keys in a local `.env`. The session id is in the new-order alert email.

```bash
npm run email:shipped -- cs_live_XXXX 9400111899223456789012 USPS
```

Each email is sent at most once per order, even if Stripe retries a webhook.

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

Open http://localhost:4242. Without a Stripe key the site runs in **preview mode**: everything works except paying. Without SMTP, emails are saved to `email-previews/` instead of being sent. To see every email template with sample data:

```bash
npm run email:preview
```

To test real payments locally, add your test key to `.env`, then forward webhooks with the [Stripe CLI](https://docs.stripe.com/stripe-cli) and put the `whsec_…` it prints in `.env`:

```bash
stripe listen --forward-to localhost:4242/api/stripe-webhook
```

Test card: `4242 4242 4242 4242`, any future date, any CVC.

## Where things live

- Colors, names, price and goal: `src/catalog.js`
- Email wording: `src/emails.js`
- Page copy: `public/index.html`

## Brand notes followed

- Logo artwork is never cropped, rotated, recolored or given effects, and only sits on quiet light backgrounds.
- Small text is plum on light backgrounds. Bright pink is used for big type, buttons and accents.
- Copy makes no edible, hypoallergenic or non-toxic claims, and "Do not eat" appears on the page and in every customer email.
