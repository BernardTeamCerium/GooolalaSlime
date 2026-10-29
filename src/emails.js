// Branded, personalized order emails. Each builder returns { subject, html, text }.
// Edit the copy freely; keep the layout table-based so it renders in every inbox.

const BRAND = {
  pink: '#F84FB3',
  aqua: '#36D4DA',
  lavender: '#9D72EB',
  plum: '#301139',
  yellow: '#FFD454',
  cream: '#FFFBF6',
  font: "'Trebuchet MS', Arial, sans-serif",
  site: 'https://gooolala.com',
  signature: 'Aviana, the Slime Queen',
};

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const money = (cents, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);

const jars = (n) => `${n} jar${n === 1 ? '' : 's'}`;

function itemRows(items, currency) {
  return items
    .map(
      (i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px dashed #E9DDF5;width:34px;vertical-align:middle;">
          <div style="width:26px;height:26px;border-radius:50%;background:${esc(i.hex)};border:2px solid ${BRAND.plum};"></div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px dashed #E9DDF5;font-family:${BRAND.font};font-size:15px;color:${BRAND.plum};">
          <strong>${esc(i.name)}</strong><br><span style="font-size:13px;opacity:.75;">${jars(i.qty)}</span>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px dashed #E9DDF5;font-family:${BRAND.font};font-size:15px;color:${BRAND.plum};">
          ${money(i.amount, currency)}
        </td>
      </tr>`
    )
    .join('');
}

function totalsRows(order) {
  const row = (label, value, strong = false) => `
    <tr>
      <td colspan="2" style="padding:6px 0;font-family:${BRAND.font};font-size:${strong ? 17 : 14}px;color:${BRAND.plum};${strong ? 'font-weight:bold;' : ''}">${label}</td>
      <td align="right" style="padding:6px 0;font-family:${BRAND.font};font-size:${strong ? 17 : 14}px;color:${BRAND.plum};${strong ? 'font-weight:bold;' : ''}">${value}</td>
    </tr>`;
  return [
    row('Subtotal', money(order.subtotal, order.currency)),
    order.discount ? row('Royal discount', `−${money(order.discount, order.currency)}`) : '',
    row('Shipping', order.shippingAmount ? money(order.shippingAmount, order.currency) : 'Free'),
    order.tax ? row('Tax', money(order.tax, order.currency)) : '',
    row('Total', money(order.total, order.currency), true),
  ].join('');
}

function addressBlock(address) {
  if (!address) return '';
  const a = address.address || {};
  const lines = [address.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(', ')].filter(Boolean);
  return `
    <p style="margin:18px 0 4px;font-family:${BRAND.font};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.plum};font-weight:bold;">Sending it to</p>
    <p style="margin:0;font-family:${BRAND.font};font-size:14px;line-height:1.6;color:${BRAND.plum};">${lines.map(esc).join('<br>')}</p>`;
}

// Shared frame: cream background, logo, colored card, royal sign-off.
function layout({ preheader, logoSrc, accent, eyebrow, heading, intro, body }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.cream};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.cream};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding-bottom:18px;">
        <img src="${esc(logoSrc)}" width="240" alt="Gooolala! by Aviana, the Slime Queen" style="display:block;width:240px;max-width:70%;height:auto;border:0;">
      </td></tr>
      <tr><td style="background:#ffffff;border:3px solid ${BRAND.plum};border-radius:24px;overflow:hidden;">
        <div style="height:12px;background-color:${BRAND.pink};background-image:${accent};"></div>
        <div style="padding:28px 28px 8px;">
          <p style="margin:0 0 8px;font-family:${BRAND.font};font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${BRAND.pink};">${esc(eyebrow)}</p>
          <h1 style="margin:0 0 14px;font-family:${BRAND.font};font-size:30px;line-height:1.15;color:${BRAND.plum};">${heading}</h1>
          <p style="margin:0 0 18px;font-family:${BRAND.font};font-size:16px;line-height:1.65;color:${BRAND.plum};">${intro}</p>
          ${body}
        </div>
        <div style="padding:18px 28px 26px;">
          <p style="margin:0;font-family:${BRAND.font};font-size:16px;line-height:1.6;color:${BRAND.plum};">Stay squishy,<br><strong>${BRAND.signature}</strong> 👑</p>
        </div>
      </td></tr>
      <tr><td align="center" style="padding:20px 10px 0;font-family:${BRAND.font};font-size:12px;line-height:1.6;color:${BRAND.plum};">
        <strong>Gooo Care:</strong> Slime is a toy, not a snack. Please do not eat. Grown-up help recommended.<br>
        Questions? Just reply to this email. · <a href="${BRAND.site}" style="color:${BRAND.plum};">gooolala.com</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function textLines(order) {
  return order.items.map((i) => `  • ${i.name} × ${i.qty} — ${money(i.amount, order.currency)}`).join('\n');
}

// order: { number, firstName, slimeFor, email, items:[{name,hex,qty,amount}], subtotal, discount,
//          shippingAmount, tax, total, currency, shipping:{name,address} }
export function orderConfirmationEmail(order, { logoSrc }) {
  const who = order.firstName ? `, ${esc(order.firstName)}` : '';
  const totalJars = order.items.reduce((n, i) => n + i.qty, 0);
  const forLine = order.slimeFor
    ? `Aviana will mix it up with extra sparkle for <strong>${esc(order.slimeFor)}</strong>.`
    : 'Aviana is already rolling up her sleeves to mix it up.';
  const subject = `👑 Your royal gooo order is in${order.firstName ? `, ${order.firstName}` : ''}! (#${order.number})`;

  const html = layout({
    preheader: `${jars(totalJars)} of Gooolala slime are headed into the royal mixing bowl.`,
    logoSrc,
    accent: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.lavender}, ${BRAND.aqua})`,
    eyebrow: `Order #${order.number}`,
    heading: `Hooray${who}! Your gooo is official.`,
    intro: `Thank you for joining the kingdom! We got your order for ${jars(totalJars)} of Royal Collection Slime. ${forLine} We’ll email you again the moment it ships.`,
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(order.items, order.currency)}${totalsRows(order)}</table>
      ${addressBlock(order.shipping)}
      <div style="margin:22px 0 4px;padding:14px 16px;background:#FFF6D6;border-radius:16px;font-family:${BRAND.font};font-size:14px;line-height:1.6;color:${BRAND.plum};">
        ✨ <strong>While you wait:</strong> pick a name for your new slime. Royal slimes love fancy names!
      </div>`,
  });

  const text = `Hooray${order.firstName ? `, ${order.firstName}` : ''}! Your gooo is official.

Order #${order.number}
${textLines(order)}
Total: ${money(order.total, order.currency)}
${order.slimeFor ? `\nMade for: ${order.slimeFor}\n` : ''}
We’ll email you again the moment it ships.

Stay squishy,
${BRAND.signature}

Slime is a toy, not a snack. Please do not eat. Grown-up help recommended.
${BRAND.site}`;

  return { subject, html, text };
}

export function orderShippedEmail(order, { logoSrc, trackingUrl, carrier, trackingNumber }) {
  const who = order.firstName ? `, ${esc(order.firstName)}` : '';
  const button = trackingUrl
    ? `<p style="margin:20px 0 6px;"><a href="${esc(trackingUrl)}" style="display:inline-block;background:${BRAND.plum};color:#ffffff;font-family:${BRAND.font};font-size:16px;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:999px;">Track my gooo →</a></p>`
    : '';
  const trackingLine = trackingNumber
    ? `<p style="margin:8px 0 0;font-family:${BRAND.font};font-size:14px;color:${BRAND.plum};">${esc(carrier || 'Tracking')} #: <strong>${esc(trackingNumber)}</strong></p>`
    : '';

  const html = layout({
    preheader: 'Your Gooolala slime just left the castle!',
    logoSrc,
    accent: `linear-gradient(90deg, ${BRAND.aqua}, ${BRAND.yellow})`,
    eyebrow: `Order #${order.number} · Shipped`,
    heading: `Your gooo just left the castle${who}! 🚚`,
    intro: `The royal jars are packed, labeled and on their way${order.slimeFor ? ` to <strong>${esc(order.slimeFor)}</strong>` : ''}. Keep an eye on the mailbox!`,
    body: `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${itemRows(order.items, order.currency)}</table>
      ${button}${trackingLine}
      ${addressBlock(order.shipping)}
      <div style="margin:22px 0 4px;padding:14px 16px;background:#E3FAFB;border-radius:16px;font-family:${BRAND.font};font-size:14px;line-height:1.6;color:${BRAND.plum};">
        💧 <strong>Gooo Care tip:</strong> keep the lid on tight between squishes so your slime stays soft and stretchy.
      </div>`,
  });

  const text = `Your gooo just left the castle${order.firstName ? `, ${order.firstName}` : ''}!

Order #${order.number}
${textLines(order)}
${trackingNumber ? `\n${carrier || 'Tracking'} #: ${trackingNumber}` : ''}${trackingUrl ? `\nTrack it: ${trackingUrl}` : ''}

Stay squishy,
${BRAND.signature}
${BRAND.site}`;

  return { subject: `🚚 Your Gooolala slime is on its way! (#${order.number})`, html, text };
}

export function paymentFailedEmail(order, { logoSrc, shopUrl }) {
  const html = layout({
    preheader: 'Your payment didn’t go through, but your colors are still waiting.',
    logoSrc,
    accent: `linear-gradient(90deg, ${BRAND.yellow}, ${BRAND.pink})`,
    eyebrow: `Order #${order.number}`,
    heading: 'Uh-oh, the payment got stuck in the gooo.',
    intro: 'Your bank didn’t complete the payment, so we haven’t started mixing yet. No worries — you can try again any time.',
    body: `<p style="margin:10px 0 6px;"><a href="${esc(shopUrl)}" style="display:inline-block;background:${BRAND.pink};color:#ffffff;font-family:${BRAND.font};font-size:16px;font-weight:bold;text-decoration:none;padding:14px 26px;border-radius:999px;">Explore the Gooo Menu</a></p>`,
  });
  const text = `Uh-oh, the payment for order #${order.number} didn’t go through, so we haven’t started mixing yet.\nTry again any time: ${shopUrl}\n\n${BRAND.signature}`;
  return { subject: `Your Gooolala order needs a little help (#${order.number})`, html, text };
}

export function ownerNewOrderEmail(order) {
  const lines = order.items.map((i) => `<li>${esc(i.name)} × ${i.qty}</li>`).join('');
  const a = order.shipping?.address || {};
  const html = `<div style="font-family:${BRAND.font};color:${BRAND.plum};font-size:15px;line-height:1.6;">
    <h2 style="margin:0 0 8px;">👑 New order #${order.number} — ${money(order.total, order.currency)}</h2>
    <p><strong>Customer:</strong> ${esc(order.customerName || '')} &lt;${esc(order.email || '')}&gt;</p>
    ${order.slimeFor ? `<p><strong>Made for:</strong> ${esc(order.slimeFor)}</p>` : ''}
    <ul>${lines}</ul>
    <p><strong>Ship to:</strong><br>${[order.shipping?.name, a.line1, a.line2, [a.city, a.state, a.postal_code].filter(Boolean).join(', '), a.country].filter(Boolean).map(esc).join('<br>')}</p>
    <p style="font-size:13px;">Stripe Checkout session: ${esc(order.sessionId)}<br>When it ships, run: <code>npm run email:shipped -- ${esc(order.sessionId)} &lt;tracking-number&gt; [carrier]</code></p>
  </div>`;
  const text = `New order #${order.number} — ${money(order.total, order.currency)}\n${order.customerName} <${order.email}>\n${order.items.map((i) => `${i.name} x ${i.qty}`).join('\n')}\nSession: ${order.sessionId}`;
  return { subject: `New Gooolala order #${order.number} (${money(order.total, order.currency)})`, html, text };
}
