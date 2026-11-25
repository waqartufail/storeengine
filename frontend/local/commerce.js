export function fail(message, status = 400) {
  throw Object.assign(Error(message), { status });
}
export function active(s) {
  return (
    s?.status === "Active" &&
    (!s.expiresAt || Date.parse(s.expiresAt) > Date.now())
  );
}
export const amount = (n) => Number.isFinite(n) && n >= 0 && n <= 10000000;
export const cents = (n) => Math.round(n * 100);
export const text = (v, max = 500) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;
export const isHttps = (s) => {
  try {
    return new URL(s).protocol === "https:";
  } catch {
    return false;
  }
};
export const stale = () =>
  fail("Data changed. Refresh and review before saving.", 409);

export function checkout(s, state, b) {
  const receipt = s.orders.find((o) => o.requestId === b.requestId);
  if (receipt) return receipt;
  if (
    !text(b.requestId, 80) ||
    !text(b.customerName) ||
    !text(b.phone, 32) ||
    !text(b.city) ||
    !text(b.address, 600) ||
    !Array.isArray(b.items) ||
    !b.items.length
  )
    fail("Complete your delivery details.");
  const payment = s.config.payments.find(
    (p) => p.enabled && p.name === b.paymentMethod,
  );
  if (!payment || (payment.kind !== "cod" && !text(b.paymentReference)))
    fail("Select an enabled method and enter the payment reference.");
  let subtotal = 0,
    grams = 0,
    highest = 0;
  const seen = new Set();
  const items = b.items.map(({ productId, quantity }) => {
    const p = s.products.find((x) => x.id === productId);
    if (
      !p ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      p.stock < quantity ||
      seen.has(productId)
    )
      fail("Stock changed. Review your bag.", 409);
    seen.add(productId);
    p.stock -= quantity;
    p.version++;
    grams += Math.round(p.weightKg * 1000) * quantity;
    highest = Math.max(highest, cents(p.shippingCharge));
    subtotal += cents(p.salePrice) * quantity;
    return {
      id: p.id,
      productId: p.id,
      productName: p.name,
      unitPrice: p.salePrice,
      listPrice: p.price,
      promoLabel: p.promoLabel,
      weightKg: p.weightKg,
      quantity,
    };
  });
  const rate = s.config.shipping;
  const shipping =
    (highest || cents(rate.baseCharge)) +
    Math.max(
      0,
      Math.ceil((grams - Math.round(rate.includedWeight * 1000)) / 1000),
    ) *
      cents(rate.extraPerKg);
  if (cents(b.expectedTotal) !== subtotal + shipping) stale();
  const o = {
    ...b,
    id: state.nextOrder++,
    subtotal: subtotal / 100,
    shipping: shipping / 100,
    total: (subtotal + shipping) / 100,
    weightKg: grams / 1000,
    items,
    createdAt: new Date().toISOString(),
    status: "Pending",
    isCod: payment.kind === "cod",
    paymentVerified: false,
    courier: s.config.defaultShipper,
    booking: "Unbooked",
    tracking: "",
  };
  s.orders.unshift(o);
  return o;
}

export function publicRoute(state, parts, method, body) {
  const [area, slug, action] = parts;
  if (area === "directory" && method === "GET")
    return state.stores
      .filter(active)
      .map((s) => ({ slug: s.slug, name: s.name }));
  const s = state.stores.find((x) => x.slug === slug);
  if (area !== "stores" || !active(s)) fail("This store is unavailable.", 404);
  if (action === "orders" && method === "POST") return checkout(s, state, body);
  if (action || method !== "GET") fail("Page unavailable.", 404);
  return {
    brand: s.brand,
    shipping: s.config.shipping,
    payments: s.config.payments.filter((x) => x.enabled),
    products: s.products,
  };
}
export const publicRequest =
  (transaction) =>
  (path, method = "GET", body = {}) =>
    transaction(method !== "GET", (s) =>
      publicRoute(s, path.split("/").filter(Boolean), method, body),
    );
