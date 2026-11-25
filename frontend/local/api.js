import {
  fail,
  active,
  amount,
  cents,
  text,
  isHttps,
  stale,
  publicRoute,
} from "./commerce";
import { accounts, hash, session, store, transaction } from "./storage";
import { themes } from "../src/themes";
function admin(s) {
  const auth = session("admin"),
    shop = s.stores.find((x) => x.id === auth?.id);
  if (!shop) fail("Please sign in to your store.", 401);
  if (!active(shop))
    fail(
      "Store access: " +
        (shop.status === "Active" ? "plan expired" : shop.status) +
        ".",
      403,
    );
  if (auth.version !== shop.sessionVersion)
    fail("Your plan changed. Please sign in again.", 401);
  return shop;
}
function expires(plan) {
  if (plan === "Lifetime") return null;
  const d = new Date();
  if (plan === "Trial") d.setUTCDate(d.getUTCDate() + 14);
  else {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + (plan === "Yearly" ? 12 : 1));
    const end = new Date(d);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    d.setUTCDate(Math.min(day, end.getUTCDate()));
  }
  return d.toISOString();
}
function product(s, state, id, b, method, query) {
  if (!id && method === "GET") return s.products;
  const index = s.products.findIndex((p) => p.id === id);
  if (id && index < 0) fail("Product unavailable.", 404);
  if (
    id &&
    s.products[index].version !==
      Number(method === "DELETE" ? query.get("version") : b.version)
  )
    stale();
  if (method === "DELETE") {
    s.products.splice(index, 1);
    return;
  }
  if (
    !text(b.name, 160) ||
    !text(b.category, 100) ||
    !amount(b.price) ||
    b.price <= 0 ||
    !Number.isInteger(b.stock) ||
    b.stock < 0 ||
    !(b.weightKg > 0) ||
    !amount(b.shippingCharge)
  )
    fail("Check product details.");
  if (
    !["None", "Percent", "Fixed"].includes(b.promoKind) ||
    !amount(b.promoValue) ||
    (b.promoKind !== "None" &&
      (!text(b.promoLabel, 100) || b.promoValue <= 0)) ||
    (b.promoKind === "Percent" && b.promoValue > 100) ||
    (b.promoKind === "Fixed" && b.promoValue > b.price)
  )
    fail("Check the promotion amount.");
  const list = cents(b.price);
  const sale =
    b.promoKind === "Percent"
      ? Math.round((list * (10000 - cents(b.promoValue))) / 10000)
      : b.promoKind === "Fixed"
        ? list - cents(b.promoValue)
        : list;
  const p = {
    ...(id ? s.products[index] : {}),
    ...b,
    id: id || state.nextProduct++,
    name: b.name.trim(),
    salePrice: sale / 100,
    version: id ? s.products[index].version + 1 : 1,
  };
  if (id) s.products[index] = p;
  else s.products.push(p);
  return p;
}
function route(state, parts, query, method, b) {
  const [area, section, arg, action] = parts;
  if (area === "directory" || area === "stores")
    return publicRoute(state, parts, method, b);
  if (area === "owner") {
    if (!session("owner")) fail("Please sign in to the owner portal.", 401);
    if (!arg)
      return state.stores.map(
        ({ id, name, email, adminName, slug, status, plan, expiresAt }) => ({
          id,
          name,
          email,
          adminName,
          slug,
          status,
          plan,
          expiresAt,
        }),
      );
    const s = state.stores.find((x) => x.id === Number(arg));
    if (!s) fail("Store unavailable.", 404);
    if (b.action === "Activate") {
      if (!["Trial", "Monthly", "Yearly", "Lifetime"].includes(b.plan))
        fail("Choose a plan.");
      s.status = "Active";
      s.plan = b.plan;
      s.expiresAt = expires(b.plan);
    } else if (["Deactivate", "Reject"].includes(b.action))
      s.status = b.action === "Deactivate" ? "Inactive" : "Rejected";
    else fail("Invalid action.");
    s.sessionVersion++;
    return;
  }
  if (area !== "admin") fail("Page unavailable.", 404);
  const s = admin(state);
  if (section === "access") return;
  if (section === "settings" && method === "GET")
    return {
      brand: s.brand,
      config: s.config,
      version: s.version,
      adminEmail: s.email,
      id: s.id,
      plan: s.plan,
      expiresAt: s.expiresAt,
    };
  if (method === "PUT" && ["settings", "brand"].includes(section)) {
    if (s.version !== b.version) stale();
    if (section === "brand") {
      if (
        !text(b.name, 100) ||
        !text(b.browserTitle, 120) ||
        !themes.some((t) => t.id === b.theme)
      )
        fail("Check the store name, title and theme.");
      const links = b.socialLinks ?? s.brand.socialLinks ?? [];
      if (
        !Array.isArray(links) ||
        links.length > 12 ||
        links.some(
          (x) => !text(x?.label, 48) || !text(x.url, 2048) || !isHttps(x.url),
        )
      )
        fail("Enter a name and HTTPS URL for each social link.");
      const video = b.promoVideo ?? s.brand.promoVideo ?? "";
      if (
        video &&
        !(isHttps(video) && video.length <= 8192) &&
        !(
          video.length <= 11184840 &&
          /^data:video\/(mp4|webm);base64,[A-Za-z0-9+/]+=*$/.test(video)
        )
      )
        fail("Choose an MP4 or WebM file or a public HTTPS video URL.");
      s.name = b.name.trim();
      s.brand = {
        name: s.name,
        browserTitle: b.browserTitle,
        slug: s.slug,
        banner: b.banner,
        socialLinks: links,
        promoVideo: video,
        logo: b.logo,
        theme: b.theme,
      };
    } else {
      const c = b.config,
        rate = c.shipping;
      const unique = (xs) =>
        new Set(xs.map((x) => x.name.trim().toLowerCase())).size === xs.length;
      if (
        !amount(rate.baseCharge) ||
        !amount(rate.extraPerKg) ||
        !(rate.includedWeight > 0) ||
        !unique(c.couriers) ||
        !unique(c.payments) ||
        !c.couriers.some((x) => x.enabled && x.name === c.defaultShipper) ||
        !c.payments.some((x) => x.enabled) ||
        c.payments.some(
          (x) =>
            !text(x.name, 64) ||
            (x.kind === "card" && x.enabled && !isHttps(x.url)),
        )
      )
        fail(
          "Check rates, the default courier, payment names and hosted card link.",
        );
      s.config = c;
    }
    return { version: ++s.version };
  }
  if (section === "products")
    return product(s, state, Number(arg), b, method, query);
  if (section === "orders") {
    if (!arg) return s.orders;
    const o = s.orders.find((x) => x.id === Number(arg));
    if (!o) fail("Order unavailable.", 404);
    if (method === "GET") return o;
    if (
      action === "status" &&
      [
        "Pending",
        "Confirmed",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ].includes(b.status)
    )
      o.status = b.status;
    else if (action === "tracking" && text(b.tracking, 120)) {
      o.booking = "Booked";
      o.tracking = b.tracking.trim();
    } else if (action === "verify-payment" && !o.isCod)
      o.paymentVerified = true;
    else fail("This action is unavailable in local mode.");
    return;
  }
  fail("Page unavailable.", 404);
}
export async function request(path, method = "GET", b = {}) {
  const [raw, query] = path.split("?"),
    parts = raw.split("/").filter(Boolean);
  if (
    __NW_ROLE__ === "admin" &&
    (parts[0] === "owner" || (parts[0] === "auth" && parts[1] === "owner"))
  )
    fail("Unavailable.", 404);
  if (
    __NW_ROLE__ === "owner" &&
    (parts[0] === "admin" || (parts[0] === "auth" && parts[1] !== "owner"))
  )
    fail("Unavailable.", 404);
  if (parts[0] !== "auth")
    return transaction(method !== "GET", (state) =>
      route(state, parts, new URLSearchParams(query), method, b),
    );
  const [, role, action] = parts;
  if (action === "logout") {
    session(role, null);
    return;
  }
  const email = (b.email || "").trim().toLowerCase();
  if (role === "signup") {
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      !text(b.name, 100) ||
      !text(b.adminName, 100) ||
      b.password?.length < 12 ||
      b.password?.length > 128
    )
      fail("Check your store name, email and password (12–128 characters).");
    const identity = await hash(b.password);
    return transaction(true, (state) => {
      if (state.stores.some((s) => s.email === email))
        fail("This email is already registered.", 409);
      const id = state.nextStore++,
        prefix =
          b.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "store";
      state.stores.push(
        store(
          id,
          b.name.trim(),
          b.adminName.trim(),
          email,
          identity,
          prefix + "-" + id,
        ),
      );
    });
  }
  if (
    role === "owner" &&
    action === "login" &&
    email === accounts.owner.email &&
    b.password === accounts.owner.password
  ) {
    session(role, { id: "owner" });
    return;
  }
  if (role === "admin" && action === "login") {
    const s = await transaction(false, (state) =>
      state.stores.find((x) => x.email === email),
    );
    if (
      s &&
      (await hash(b.password, s.identity.salt)).digest === s.identity.digest
    ) {
      if (!active(s))
        fail(
          "Store access: " +
            (s.status === "Active" ? "plan expired" : s.status) +
            ".",
          403,
        );
      session(role, { id: s.id, version: s.sessionVersion });
      return;
    }
  }
  fail("Check the email and password.", 401);
}
