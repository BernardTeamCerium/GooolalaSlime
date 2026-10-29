// The one product sold on the landing page, plus its color choices.
// Prices live here (server side) so shoppers can't change them in the browser.

export const PRODUCT = {
  id: 'royal-collection-slime',
  name: 'Royal Collection Slime',
  tagline: 'Royally fun to squish!',
  description:
    'One jar of handmade Gooolala slime in the color of your choice, finished with the official royal lid label.',
  // Price per jar in cents (USD). $8.00 matches the design preview — confirm before launch.
  unitAmount: Number(process.env.PRICE_CENTS || 800),
  currency: 'usd',
  maxPerColor: 10,
  maxPerOrder: 30,
};

// Colors from "06 The First Royal Collection" in the brand guide.
// Names suggest color and fantasy only: no food, scent or safety claims.
export const COLORS = [
  { id: 'queens-pink', name: 'Queen’s Pink', hex: '#F84FB3', blurb: 'The royal favorite. Bold, bright and fit for a crown.' },
  { id: 'royal-grape', name: 'Royal Grape', hex: '#9D72EB', blurb: 'A lavender cloak for every kingdom adventure.' },
  { id: 'mermaid-majesty', name: 'Mermaid Majesty', hex: '#36D4DA', blurb: 'Sea-glass aqua straight from the mermaid court.' },
  { id: 'enchanted-emerald', name: 'Enchanted Emerald', hex: '#35BD91', blurb: 'Deep green from the wishing woods.' },
  { id: 'lime-palace', name: 'Lime Palace', hex: '#A7D83C', blurb: 'As bright as the palace garden hedges.' },
  { id: 'sunshine-crown', name: 'Sunshine Crown', hex: '#FFD454', blurb: 'Golden like the queen’s crown at noon.' },
  { id: 'peachy-princess', name: 'Peachy Princess', hex: '#FFAB87', blurb: 'Soft sunset coral for gentle royals.' },
  { id: 'dragons-fire', name: 'Dragon’s Fire', hex: '#FF735F', blurb: 'Fiery orange-red with dragon-sized courage.' },
  { id: 'blue-gooo-lagoon', name: 'Blue Gooo Lagoon', hex: '#539DF5', blurb: 'Cool, calm blue from the royal lagoon.' },
  { id: 'moonlight-pearl', name: 'Moonlight Pearl', hex: '#E8E6F3', blurb: 'Pale and dreamy as moonlight on the castle.' },
];

export const colorById = (id) => COLORS.find((c) => c.id === id);

// Validates a cart sent from the browser: [{ colorId, qty }] -> [{ color, qty }].
export function validateCart(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Your Gooo bag is empty.');
  const merged = new Map();
  for (const item of items) {
    const color = colorById(item?.colorId);
    const qty = Number(item?.qty);
    if (!color) throw new Error('That color isn’t in the royal collection.');
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Quantities must be whole numbers.');
    merged.set(color.id, (merged.get(color.id) || 0) + qty);
  }
  let total = 0;
  const cart = [];
  for (const [id, qty] of merged) {
    if (qty > PRODUCT.maxPerColor) throw new Error(`Up to ${PRODUCT.maxPerColor} jars per color, please.`);
    total += qty;
    cart.push({ color: colorById(id), qty });
  }
  if (total > PRODUCT.maxPerOrder) throw new Error(`Up to ${PRODUCT.maxPerOrder} jars per order, please.`);
  return cart;
}
