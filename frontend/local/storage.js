import { createWorkspace } from "./database.js";
// Each read-modify-write completes inside one IndexedDB transaction, including stock and receipt.
export const accounts = {
  owner:
    typeof __NW_ROLE__ !== "undefined" && __NW_ROLE__ === "owner"
      ? { email: "owner@naturwala.local", password: "NaturOwner123!" }
      : null,
  admin:
    typeof __NW_ROLE__ !== "undefined" && __NW_ROLE__ === "admin"
      ? { email: "admin@naturwala.local", password: "NaturAdmin123!" }
      : null,
};
const databaseName =
  "NaturWala.Local.v1:" +
  (typeof location === "undefined"
    ? ""
    : new URL("RUN-LOCAL.html", location.href).pathname);
const now = () => new Date().toISOString();
export function config() {
  return {
    shipping: { baseCharge: 200, includedWeight: 5, extraPerKg: 50 },
    defaultShipper: "PostEx",
    couriers: ["PostEx", "TCS", "Leopards", "M&P"].map((name, i) => ({
      name,
      enabled: !i,
      pickupCode: "",
      notes: "",
      apiUrl: "",
    })),
    payments: [
      "Cash on Delivery",
      "Easypaisa",
      "JazzCash",
      "Bank Transfer",
      "Card Payment",
    ].map((name, i) => ({
      name,
      kind: i === 0 ? "cod" : i === 4 ? "card" : "online",
      enabled: i === 0,
      qr: "",
      url: "",
      details: i === 0 ? "Pay on delivery" : "",
    })),
    whatsApp: {
      enabled: false,
      businessPhone: "",
      template: "order_confirmation",
      phoneId: "",
    },
  };
}
export function store(id, name, adminName, email, identity, slug) {
  return {
    id,
    name,
    adminName,
    email,
    identity,
    slug,
    status: "Pending",
    plan: "",
    expiresAt: null,
    createdAt: now(),
    sessionVersion: 0,
    version: 0,
    brand: {
      name,
      browserTitle: name,
      logo: "",
      banner: "",
      theme: "royal",
      slug,
    },
    config: config(),
    products: [],
    orders: [],
  };
}
export function seed() {
  const s = store(
    1,
    "Natur-Wala & Co.",
    "Sample merchant",
    "admin@naturwala.local",
    {
      salt: "natur-wala-local-admin",
      digest:
        "220ccc8c54b89e4d13a57d667e1b337dd2e82cffe6727659c44a256fc6f97666",
    },
    "natur-wala",
  );
  s.plan = "Lifetime";
  s.status = "Active";
  s.products = [
    ["Wildflower Honey", "Pantry", 850, 0.5, 400, "g"],
    ["Mint Green Tea", "Tea", 520, 0.125, 100, "g"],
    ["Cold-Pressed Almond Oil", "Oils", 1250, 0.25, 200, "ml"],
  ].map(([name, category, price, weightKg, netQuantity, netUnit], i) => ({
    id: i + 1,
    name,
    category,
    description: "",
    price,
    stock: 12,
    weightKg,
    netQuantity,
    netUnit,
    shippingCharge: 0,
    imageUrl: "",
    promoKind: i === 0 ? "Percent" : "None",
    promoValue: i === 0 ? 10 : 0,
    promoLabel: i === 0 ? "Honey special · 10% off" : "",
    salePrice: i === 0 ? price * 0.9 : price,
    version: 1,
  }));
  return { stores: [s], nextStore: 2, nextProduct: 4, nextOrder: 1 };
}
export const transaction = createWorkspace(databaseName, seed);
export async function hash(password, salt = crypto.randomUUID()) {
  const bytes = new TextEncoder(),
    key = await crypto.subtle.importKey(
      "raw",
      bytes.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 120000,
      salt: bytes.encode(salt),
    },
    key,
    256,
  );
  return {
    salt,
    digest: Array.from(new Uint8Array(bits), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
export function session(role, value) {
  const key = databaseName + ":" + role;
  if (value === null) sessionStorage.removeItem(key);
  else if (value !== undefined)
    sessionStorage.setItem(
      key,
      JSON.stringify({ ...value, until: Date.now() + 8 * 3600000 }),
    );
  const s = JSON.parse(sessionStorage.getItem(key) || "null");
  return s?.until > Date.now() ? s : null;
}
