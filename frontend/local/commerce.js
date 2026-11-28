import { freshId } from "../src/freshId";
import { googleEmail } from "./googleEmail";
import { defaultOffer } from "../src/newsletterRule";
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
      netQuantity: p.netQuantity ?? null,
      netUnit: p.netUnit || "",
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
  let discount = 0;
  if (b.newsletterCode) {
    const rule = s.config.newsletter;
    const sub = s.subscribers?.find(
      (x) => x.code === b.newsletterCode && !x.used,
    );
    if (!rule?.enabled || !sub || subtotal < cents(rule.minimum))
      fail("Newsletter offer unavailable for this order.");
    discount = Math.round((subtotal * rule.percent) / 100);
    sub.used = true;
  }
  if (cents(b.expectedTotal) !== subtotal - discount + shipping) stale();
  const { newsletterCode, ...delivery } = b;
  const o = {
    ...delivery,
    newsletterDiscount: discount / 100,
    id: state.nextOrder++,
    subtotal: subtotal / 100,
    shipping: shipping / 100,
    total: (subtotal - discount + shipping) / 100,
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

export function publicRoute(state, parts, method, body, verifiedClient = null) {
  const [area, slug, action] = parts;
  if (area === "directory" && method === "GET")
    return state.stores
      .filter(active)
      .map((s) => ({ slug: s.slug, name: s.name }));
  const s = state.stores.find((x) => x.slug === slug);
  if (area !== "stores" || !active(s)) fail("This store is unavailable.", 404);
  if (action === "newsletter" && method === "POST") {
    const rule = s.config.newsletter;
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (
      !rule?.enabled ||
      body.consent !== true ||
      ((verifiedClient || rule.googleOnly) &&
        verifiedClient !== rule.googleClientId) ||
      body.credential ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    )
      fail(
        "Use a valid email with consent and the sign-in method selected by this store.",
      );
    s.subscribers ??= [];
    const prior = s.subscribers.find((x) => x.email === email);
    if (prior && (!verifiedClient || prior.used))
      fail("A welcome offer is unavailable for this address.");
    const code = freshId();
    if (prior) prior.code = code;
    else
      s.subscribers.push({
        email,
        used: false,
        joined: new Date().toISOString(),
        code,
      });
    return { code };
  }
  if (action === "products" && parts[4] === "rating") {
    const productId = Number(parts[3]);
    if (!s.products.some((p) => p.id === productId))
      fail("Product unavailable.", 404);
    const rows = s.ratings || [];
    if (method === "POST") {
      if (
        !Number.isInteger(body.stars) ||
        body.stars < 1 ||
        body.stars > 5 ||
        !text(body.voter, 64)
      )
        fail("Choose one to five stars.");
      const old = rows.find(
        (x) => x.id === productId && x.voter === body.voter,
      );
      if (old) old.stars = body.stars;
      else rows.push({ id: productId, voter: body.voter, stars: body.stars });
      s.ratings = rows;
    }
    const votes = rows.filter((x) => x.id === productId);
    return {
      count: votes.length,
      average: votes.length
        ? Math.round(
            (votes.reduce((n, x) => n + x.stars, 0) * 10) / votes.length,
          ) / 10
        : 0,
    };
  }
  if (action === "orders" && method === "POST") return checkout(s, state, body);
  const revision =
    String(s.version ?? 0) +
    "." +
    s.products.map((p) => p.id + ":" + p.version).join(",");
  if (action === "revision" && method === "GET") return revision;
  if (action || method !== "GET") fail("Page unavailable.", 404);
  return {
    revision,
    brand: s.brand,
    newsletter: s.config.newsletter || defaultOffer,
    shipping: s.config.shipping,
    payments: s.config.payments.filter((x) => x.enabled),
    products: s.products,
  };
}
export const publicRequest =
  (transaction) =>
  async (path, method = "GET", body = {}) => {
    const parts = path.split("/").filter(Boolean);
    let verified = null;
    if (parts[2] === "newsletter" && method === "POST" && body.credential) {
      verified = await transaction(
        false,
        (state) =>
          state.stores.find((s) => s.slug === parts[1])?.config.newsletter
            ?.googleClientId,
      );
      const email = await googleEmail(body.credential, verified);
      body = { ...body, email, credential: null };
    }
    return transaction(method !== "GET", (s) =>
      publicRoute(s, parts, method, body, verified),
    );
  };
