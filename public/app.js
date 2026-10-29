// Gooolala landing page: color picker, the "My Gooo" bag, and Stripe checkout.

const FALLBACK = {
  product: {
    name: 'Royal Collection Slime',
    description: 'One jar of handmade Gooolala slime in the color of your choice, finished with the official royal lid label.',
    unitAmount: 800, currency: 'usd', maxPerColor: 10, maxPerOrder: 30, salesGoal: 100, makeDays: 3,
  },
  colors: [],
  shipping: { amount: 500, freeFrom: 0 },
  checkoutEnabled: false,
};
const BAG_KEY = 'gooolala-bag';

const $ = (sel) => document.querySelector(sel);
const state = { config: FALLBACK, selected: null, qty: 1, bag: loadBag() };

const money = (cents) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: state.config.product.currency.toUpperCase() }).format(cents / 100);

function loadBag() {
  try { return JSON.parse(localStorage.getItem(BAG_KEY)) || {}; } catch { return {}; }
}
function saveBag() {
  try { localStorage.setItem(BAG_KEY, JSON.stringify(state.bag)); } catch { /* private mode: bag just won't persist */ }
}
const bagTotalQty = () => Object.values(state.bag).reduce((a, b) => a + b, 0);
const colorById = (id) => state.config.colors.find((c) => c.id === id);

// ---------- Init ----------
async function init() {
  $('#year').textContent = new Date().getFullYear();
  try {
    const res = await fetch('/api/config');
    if (res.ok) state.config = await res.json();
  } catch { /* opened without the server; the page still renders */ }

  // Drop anything in a saved bag that's no longer in the collection.
  for (const id of Object.keys(state.bag)) if (!colorById(id)) delete state.bag[id];

  const { product, shipping } = state.config;
  $('#product-name').textContent = product.name;
  $('#product-desc').textContent = product.description;
  $('#price').textContent = money(product.unitAmount);
  $('#announce-shipping').textContent = shipping.freeFrom
    ? `Free royal shipping on orders ${money(shipping.freeFrom)}+`
    : shipping.amount ? `Royal shipping ${money(shipping.amount)}` : 'Free royal shipping';
  for (const el of document.querySelectorAll('[data-make-days]')) el.textContent = product.makeDays;
  $('#ship-note').textContent =
    `🫙 Made to order in about ${product.makeDays} days, then shipped` +
    (shipping.freeFrom ? `. Free shipping on orders ${money(shipping.freeFrom)}+.`
      : shipping.amount ? ` for ${money(shipping.amount)}.` : ' free!');
  $('#bag-tax').hidden = !state.config.taxAtCheckout;

  renderSwatches();
  selectColor(state.config.colors[0]?.id, false);
  renderBag();
  loadGoal();

  if (new URLSearchParams(location.search).has('canceled')) {
    toast('Checkout canceled. Your gooo is still waiting in the bag!');
    history.replaceState(null, '', location.pathname + location.hash);
  }
}

// ---------- Royal Goal ----------
async function loadGoal() {
  if (!state.config.checkoutEnabled) return;
  try {
    const res = await fetch('/api/progress');
    if (!res.ok) return;
    const { sold, goal } = await res.json();
    if (!goal) return;
    const pct = Math.min(100, Math.round((sold / goal) * 100));
    $('#goal-sold').textContent = sold;
    $('#goal-target').textContent = goal;
    $('#goal-bar').setAttribute('aria-valuenow', String(pct));
    $('#goal-msg').textContent =
      sold >= goal ? `🎉 Goal reached! Thank you, royal family. The gooo keeps flowing!`
      : sold === 0 ? `Help Aviana make her first ${goal} jars of gooo! Yours could be number one.`
      : `Only ${goal - sold} more jar${goal - sold === 1 ? '' : 's'} to go. Help Aviana reach ${goal}!`;
    $('#goal').classList.toggle('done', sold >= goal);
    $('#goal').hidden = false;
    // Let the bar grow in once it's visible.
    requestAnimationFrame(() => requestAnimationFrame(() => { $('#goal-fill').style.width = `${pct}%`; }));
  } catch { /* the goal is a bonus; the page works without it */ }
}

// ---------- Color picker ----------
function renderSwatches() {
  const wrap = $('#swatches');
  wrap.innerHTML = '';
  for (const c of state.config.colors) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', 'false');
    b.dataset.id = c.id;
    b.innerHTML = `<span class="swatch-dot" style="--c:${c.hex}"></span><span>${c.name}</span>`;
    b.addEventListener('click', () => selectColor(c.id));
    wrap.append(b);
  }
  // Arrow keys move through the colors like a normal radio group.
  wrap.addEventListener('keydown', (e) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const list = state.config.colors;
    const i = list.findIndex((c) => c.id === state.selected);
    const next = list[(i + keys[e.key] + list.length) % list.length];
    selectColor(next.id);
    wrap.querySelector(`[data-id="${next.id}"]`).focus();
  });
}

function selectColor(id, animate = true) {
  const c = colorById(id);
  if (!c) return;
  state.selected = id;
  for (const b of document.querySelectorAll('.swatch')) {
    const on = b.dataset.id === id;
    b.setAttribute('aria-checked', String(on));
    b.tabIndex = on ? 0 : -1;
  }
  const stage = $('#stage');
  stage.style.setProperty('--slime', c.hex);
  $('#stage-tag').textContent = c.name;
  $('#color-name').textContent = c.name;
  $('#color-blurb').textContent = c.blurb;
  if (animate) {
    stage.classList.remove('splash');
    void stage.offsetWidth; // restart the animation
    stage.classList.add('splash');
  }
}

// ---------- Quantity + add ----------
function setQty(n) {
  state.qty = Math.max(1, Math.min(state.config.product.maxPerColor, n));
  $('#qty').textContent = state.qty;
}
$('#qty-minus').addEventListener('click', () => setQty(state.qty - 1));
$('#qty-plus').addEventListener('click', () => setQty(state.qty + 1));

$('#add').addEventListener('click', (e) => {
  const { maxPerColor, maxPerOrder } = state.config.product;
  const id = state.selected;
  const c = colorById(id);
  if (!c) return;
  const inBag = state.bag[id] || 0;
  const room = Math.min(maxPerColor - inBag, maxPerOrder - bagTotalQty());
  if (room <= 0) {
    toast(inBag >= maxPerColor ? `That’s the most ${c.name} we can send in one order!` : `Your bag is full! (${maxPerOrder} jars max)`);
    return;
  }
  const added = Math.min(room, state.qty);
  state.bag[id] = inBag + added;
  saveBag();
  renderBag();
  confetti(e.currentTarget, c.hex);
  const count = $('#bag-count');
  count.classList.remove('bump'); void count.offsetWidth; count.classList.add('bump');
  toast(`👑 ${added} ${c.name} added to your gooo!`);
  setQty(1);
});

// ---------- Bag ----------
function shippingFor(subtotal) {
  const { amount, freeFrom } = state.config.shipping;
  if (!amount || (freeFrom && subtotal >= freeFrom)) return 0;
  return amount;
}

function renderBag() {
  const { unitAmount, maxPerColor } = state.config.product;
  const { freeFrom } = state.config.shipping;
  const body = $('#bag-body');
  const ids = Object.keys(state.bag);
  const qty = bagTotalQty();
  const subtotal = qty * unitAmount;

  $('#bag-count').textContent = qty;
  $('#bag-subtotal').textContent = money(subtotal);
  $('#checkout').disabled = qty === 0;

  if (!ids.length) {
    body.innerHTML = `<div class="bag-empty"><span class="big" aria-hidden="true">🫙</span><p><strong>Your bag is empty.</strong><br>Pick a happy color to get started!</p>
      <a class="btn btn-pink" href="#menu" data-close>Explore the Gooo Menu</a></div>`;
  } else {
    body.innerHTML = ids
      .map((id) => {
        const c = colorById(id);
        return `<div class="bag-item">
          <span class="swatch-dot" style="--c:${c.hex}" aria-hidden="true"></span>
          <div><div class="bag-item-name">${c.name}</div><div class="bag-item-price">${money(unitAmount * state.bag[id])}</div></div>
          <div class="qty" role="group" aria-label="${c.name} quantity">
            <button type="button" data-dec="${id}" aria-label="One less ${c.name}">−</button>
            <output>${state.bag[id]}</output>
            <button type="button" data-inc="${id}" aria-label="One more ${c.name}" ${state.bag[id] >= maxPerColor ? 'disabled' : ''}>+</button>
          </div>
        </div>`;
      })
      .join('');
  }

  const ship = shippingFor(subtotal);
  let shipHtml = qty ? `Shipping: <strong>${ship ? money(ship) : 'Free!'}</strong>` : '';
  if (qty && freeFrom && subtotal < freeFrom) {
    const pct = Math.round((subtotal / freeFrom) * 100);
    shipHtml += ` · ${money(freeFrom - subtotal)} away from free shipping!<div class="progress" aria-hidden="true"><span style="width:${pct}%"></span></div>`;
  }
  $('#bag-ship').innerHTML = shipHtml;
  $('#bag-error').textContent = '';
}

$('#bag-body').addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]')?.dataset.inc;
  const dec = e.target.closest('[data-dec]')?.dataset.dec;
  if (e.target.closest('[data-close]')) closeBag();
  if (inc && bagTotalQty() < state.config.product.maxPerOrder) state.bag[inc] = Math.min(state.config.product.maxPerColor, state.bag[inc] + 1);
  if (dec) {
    state.bag[dec] -= 1;
    if (state.bag[dec] <= 0) delete state.bag[dec];
  }
  if (inc || dec) { saveBag(); renderBag(); }
});

let lastFocus;
function openBag() {
  lastFocus = document.activeElement;
  $('#scrim').hidden = false;
  $('#bag').hidden = false;
  document.body.style.overflow = 'hidden';
  $('#close-bag').focus();
}
function closeBag() {
  $('#scrim').hidden = true;
  $('#bag').hidden = true;
  document.body.style.overflow = '';
  lastFocus?.focus();
}
$('#open-bag').addEventListener('click', openBag);
$('#close-bag').addEventListener('click', closeBag);
$('#scrim').addEventListener('click', closeBag);
document.addEventListener('keydown', (e) => {
  if ($('#bag').hidden) return;
  if (e.key === 'Escape') closeBag();
  if (e.key === 'Tab') { // keep keyboard focus inside the drawer
    const f = [...$('#bag').querySelectorAll('button:not([disabled]), a[href]')];
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

// ---------- Checkout ----------
$('#checkout').addEventListener('click', async () => {
  const btn = $('#checkout');
  const err = $('#bag-error');
  err.textContent = '';
  if (!state.config.checkoutEnabled) {
    err.textContent = 'Checkout is in preview mode. Real orders open soon!';
    return;
  }
  btn.disabled = true;
  btn.firstChild.textContent = 'Opening the royal checkout… ';
  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Object.entries(state.bag).map(([colorId, qty]) => ({ colorId, qty })) }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || 'Something went splat. Please try again.');
    location.href = data.url;
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.firstChild.textContent = 'Grown-up checkout ';
  }
});

// ---------- Little delights ----------
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function confetti(from, hex) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from.getBoundingClientRect();
  const colors = [hex, '#F84FB3', '#36D4DA', '#9D72EB', '#FFD454'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('span');
    p.className = 'confetti';
    p.style.background = colors[i % colors.length];
    p.style.left = `${r.left + r.width / 2}px`;
    p.style.top = `${r.top + r.height / 2}px`;
    document.body.append(p);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 60}px)) scale(.4)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.4,1)' }
    ).onfinish = () => p.remove();
  }
}

init();
