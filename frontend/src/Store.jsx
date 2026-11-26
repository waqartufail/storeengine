import NetSize from "./NetSize";
import {
  categories,
  storeCategories,
  matchesCategory,
  sortProducts,
} from "./categories";
import { defaults, localeName, translator, direction } from "./storeLocale";
import SocialIcon from "./SocialIcon";
import StoreBanner from "./StoreBanner";
import ProductPage, { ProductPhoto } from "./ProductPage";
import { link, logo, scrollToCatalog } from "./navigation";
import React, { useEffect, useState, useRef } from "react";
import {
  Header,
  Field,
  Select,
  Message,
  api,
  money,
  useAction,
  useTheme,
} from "./ui";
function freshId() {
  return (
    crypto.randomUUID?.() ||
    "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
      (
        +c ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
      ).toString(16),
    )
  );
}
function storedReceipt(key) {
  try {
    const number = new URL(location.href).searchParams.get("order");
    const saved = JSON.parse(sessionStorage.getItem(key) || "null");
    return saved && String(saved.id) === number ? saved : null;
  } catch {
    return null;
  }
}
function receiptUrl(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("order", String(id));
  else url.searchParams.delete("order");
  history.replaceState(history.state, "", url);
}
function newBag() {
  return { items: {}, requestId: freshId() };
}
function readBag(key) {
  try {
    const b = JSON.parse(localStorage.getItem(key));
    return b?.items && b?.requestId ? b : newBag();
  } catch {
    return newBag();
  }
}
export function Directory() {
  const [stores, set] = useState([]);
  const a = useAction();
  useTheme(null);
  useEffect(() => {
    a.run(async () => set(await api("/directory")));
  }, []);
  return (
    <>
      <Header />
      <main className="wrap">
        <div className="eyebrow">NATUR-WALA & CO.</div>
        <h1>Our stores</h1>
        <Message text={a.message} />
        <section className="panel">
          {stores.map((s) => (
            <div className="row" key={s.slug}>
              <b>{s.name}</b>
              <a href={link("/store/" + s.slug)}>Visit store →</a>
            </div>
          ))}
          {!stores.length && !a.busy && <p>No stores are open yet.</p>}
        </section>
      </main>
    </>
  );
}
export default function Store({ slug, productId }) {
  const path = "/stores/" + encodeURIComponent(slug),
    key = "nw.bag." + (window.NW_LOCAL?.scope || "/store/" + slug) + "." + slug,
    receiptKey = key + ".receipt";
  const [data, set] = useState(null),
    [failure, fail] = useState(""),
    [bag, setBag] = useState(() => readBag(key)),
    [drawer, open] = useState(false),
    [checkout, check] = useState(false);
  const [category, cat] = useState(
      () => new URL(location.href).searchParams.get("category") || "",
    ),
    [sort, setSort] = useState("new"),
    [chosen, chooseLang] = useState(() => {
      try {
        return localStorage.getItem(key + ".language") || "";
      } catch {
        return "";
      }
    }),
    [search, find] = useState(""),
    [pay, selectPay] = useState(""),
    [receipt, accept] = useState(() => storedReceipt(receiptKey));
  const a = useAction();
  useTheme(data?.brand);
  const cfg = data?.brand.languages || defaults;
  const lang = Object.hasOwn(cfg.packs, chosen) ? chosen : cfg.default;
  const t = translator(lang, cfg);
  const catLabel = (name) => t("category:" + name.toLowerCase(), name);
  const fmt = (n) =>
    lang === "en"
      ? money(n)
      : new Intl.NumberFormat(lang, {
          style: "currency",
          currency: "PKR",
          maximumFractionDigits: 2,
        }).format(n);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = direction(lang);
    return () => {
      document.documentElement.lang = "en";
      document.documentElement.dir = "ltr";
    };
  }, [lang]);
  function setLanguage(value) {
    chooseLang(value);
    try {
      localStorage.setItem(key + ".language", value);
    } catch {}
  }
  const version = useRef(null),
    seq = useRef(0),
    pending = useRef(false);
  async function load(checkOnly = false) {
    if (checkOnly && pending.current) return;
    pending.current = true;
    const id = ++seq.current;
    try {
      if (checkOnly && version.current !== null) {
        const revision = await api(path + "/revision");
        if (id !== seq.current || revision === version.current) return;
      }
      const fresh = await api(path);
      if (id !== seq.current) return;
      version.current = fresh.revision ?? null;
      set(fresh);
      fail("");
    } catch (e) {
      if (id === seq.current) {
        version.current = null;
        set(null);
        fail(e.message);
      }
    } finally {
      if (id === seq.current) pending.current = false;
    }
  }
  useEffect(() => {
    load();
    const update = () => {
      if (!document.hidden) load(true);
    };
    const timer = setInterval(update, 8000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    window.addEventListener("focus", update);
    return () => {
      seq.current++;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
      window.removeEventListener("focus", update);
    };
  }, [slug]);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(bag));
    } catch {}
  }, [bag, key]);
  function change(id, qty) {
    setBag((b) => {
      const items = { ...b.items };
      if (qty <= 0) delete items[id];
      else items[id] = qty;
      return { items, requestId: freshId() };
    });
  }
  useEffect(() => {
    if (!drawer) return;
    const escape = (e) => {
      if (e.key === "Escape") open(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [drawer]);
  if (receipt)
    return (
      <>
        <Header brand={data?.brand} />
        <main className="wrap">
          <section className="panel thankYou">
            <span className="eyebrow">{t("ORDER CONFIRMATION")}</span>
            <h1>{t("Thank you for your order!")}</h1>
            <p>{t("Your order has been placed.")}</p>
            <p className="orderNumber">
              {t("Order number")}
              <strong>#{receipt.id}</strong>
            </p>
            <div className="totals">
              <p>
                {t("Subtotal")}
                <b>{fmt(receipt.subtotal)}</b>
              </p>
              <p>
                {t("Shipping")}
                <b>{fmt(receipt.shipping)}</b>
              </p>
              <p>
                {t("Total")}
                <b>{fmt(receipt.total)}</b>
              </p>
              <p>
                {t("Payment method")}
                <b>{receipt.paymentMethod}</b>
              </p>
            </div>
            <button
              className="cta"
              onClick={() => {
                try {
                  sessionStorage.removeItem(receiptKey);
                } catch {}
                receiptUrl(null);
                accept(null);
              }}
            >
              {t("Continue shopping")}
            </button>
          </section>
        </main>
      </>
    );
  if (!data)
    return (
      <>
        <Header />
        <main className="wrap">
          <h1>{failure || t("Loading store…")}</h1>
          <a href={link("/store")}>{t("Store directory")}</a>
        </main>
      </>
    );
  const { brand, shipping, payments } = data;
  const products = data.products.map((p) => ({
    ...p,
    ...Object.fromEntries(
      ["name", "description", "details", "promoLabel"].map((k) => [
        k,
        t("p:" + p.id + ":" + k, p[k] || ""),
      ]),
    ),
  }));
  const choices = storeCategories(products);
  function categoryUrl(c) {
    const u = new URL(link("/store/" + slug), location.href);
    if (c) u.searchParams.set("category", c);
    else u.searchParams.delete("category");
    return u.href;
  }
  function pickCategory(c) {
    cat(c);
    history.replaceState(history.state, "", categoryUrl(c));
  }

  const items = Object.entries(bag.items).map(([id, qty]) => ({
    id: Number(id),
    qty,
    p: products.find((p) => p.id === Number(id)),
  }));
  const count = items.reduce((s, x) => s + x.qty, 0),
    invalid = items.some((x) => !x.p || x.qty > x.p.stock);
  const subCents = items.reduce(
    (s, x) => s + Math.round((x.p?.salePrice || 0) * 100) * x.qty,
    0,
  );
  const grams = items.reduce(
    (s, x) => s + Math.round((x.p?.weightKg || 0) * 1000) * x.qty,
    0,
  );
  const highest = Math.max(0, ...items.map((x) => x.p?.shippingCharge || 0));
  const shipCents = items.length
    ? Math.round((highest || shipping.baseCharge) * 100) +
      Math.max(
        0,
        Math.ceil((grams - Math.round(shipping.includedWeight * 1000)) / 1000),
      ) *
        Math.round(shipping.extraPerKg * 100)
    : 0;
  const total = (subCents + shipCents) / 100,
    method = payments.find((x) => x.name === pay) || payments[0];
  const filtered = sortProducts(
    products.filter(
      (p) =>
        matchesCategory(p.category, category) &&
        p.name.toLowerCase().includes(search.toLowerCase()),
    ),
    sort,
  );
  async function place(e) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    await a.run(async () => {
      const r = await api(path + "/orders", "POST", {
        ...form,
        paymentMethod: method.name,
        paymentReference: form.paymentReference || "",
        requestId: bag.requestId,
        expectedTotal: total,
        items: items.map((x) => ({ productId: x.id, quantity: x.qty })),
      }).catch(async (e) => {
        if ([404, 409].includes(e.status)) await load();
        throw e;
      });
      const summary = {
        id: r.id,
        total: r.total,
        subtotal: r.subtotal,
        shipping: r.shipping,
        paymentMethod: r.paymentMethod,
      };
      try {
        sessionStorage.setItem(receiptKey, JSON.stringify(summary));
        receiptUrl(r.id);
      } catch {}
      accept(summary);
      window.scrollTo(0, 0);
      setBag(newBag());
      open(false);
      check(false);
      await load();
    });
  }
  return (
    <>
      <Header brand={brand}>
        <a
          href={productId ? link("/store/" + slug) : "#catalog"}
          onClick={productId ? undefined : scrollToCatalog}
        >
          {t("Shop")}
        </a>
        <label className="storeLang">
          <select
            aria-label={t("Language")}
            value={lang}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {Object.keys(cfg.packs).map((c) => (
              <option key={c} value={c} lang={c}>
                {localeName(c)}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => open(true)}>
          {t("Bag")} ({count})
        </button>
      </Header>
      {productId ? (
        <ProductPage
          key={productId}
          product={products.find((p) => p.id === Number(productId))}
          brand={brand}
          slug={slug}
          products={products}
          t={t}
          fmt={fmt}
          catLabel={catLabel}
          historyKey={key + ".views"}
          bag={bag.items}
          quantity={bag.items[productId] || 0}
          add={() => change(Number(productId), (bag.items[productId] || 0) + 1)}
        />
      ) : (
        <>
          <section className="hero">
            <div className="heroText">
              <div className="eyebrow">{brand.name}</div>
              <h1>
                {t("Good things.")}
                <br />
                <em>{t("Better living.")}</em>
              </h1>
              <p>
                {t(
                  "Discover useful, well-designed essentials for your everyday life.",
                )}
              </p>
              <a className="cta" href="#catalog" onClick={scrollToCatalog}>
                {t("Explore collection")} →
              </a>
            </div>
            <div className="heroImg">
              <StoreBanner brand={brand} t={t} />
            </div>
          </section>
          <main className="wrap" id="catalog">
            <div className="head">
              <div>
                <div className="eyebrow">{t("THE COLLECTION")}</div>
                <h2>{t("Shop essentials")}</h2>
              </div>
              <input
                className="search"
                aria-label={t("Search products")}
                placeholder={t("Search products") + "..."}
                value={search}
                onChange={(e) => find(e.target.value)}
              />
            </div>
            <div className="catalogTools">
              <div className="filters">
                {["", ...choices].map((c) => (
                  <button
                    aria-pressed={category === c}
                    key={c}
                    className={category === c ? "on" : ""}
                    onClick={() => pickCategory(c)}
                  >
                    {c ? catLabel(c) : t("All")}
                  </button>
                ))}
              </div>
              <label>
                {t("Sort by")}{" "}
                <select
                  aria-label={t("Sort by")}
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  {[
                    ["new", "Newest to oldest"],
                    ["old", "Oldest to newest"],
                    ["price-low", "Price low to high"],
                    ["price-high", "Price high to low"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid">
              {filtered.map((p) => (
                <article className="product" key={p.id}>
                  <a
                    className="photo"
                    aria-label={"View " + p.name + " details"}
                    href={link("/store/" + slug + "/products/" + p.id)}
                  >
                    <ProductPhoto
                      sources={[
                        p.imageUrl,
                        ...(p.gallery || []),
                        brand.logo,
                        logo,
                      ]}
                      alt={p.name}
                      className={
                        !p.imageUrl && !p.gallery?.length ? "placeholder" : ""
                      }
                    />
                  </a>
                  <div className="info">
                    <div className="meta">
                      <span>
                        {categories(p.category).map(catLabel).join(", ")}
                      </span>
                      <span>
                        {p.stock
                          ? p.stock + " " + t("available")
                          : t("Out of stock")}
                      </span>
                    </div>
                    <h3>
                      <a href={link("/store/" + slug + "/products/" + p.id)}>
                        {p.name}
                      </a>
                    </h3>
                    <NetSize product={p} />
                    <p>{p.description}</p>
                    {p.promoLabel && (
                      <p>
                        <span className="statusPill">{p.promoLabel}</span>{" "}
                        <del>{fmt(p.price)}</del>
                      </p>
                    )}
                    <strong>{fmt(p.salePrice)}</strong>
                    <button
                      className="add"
                      aria-label={"Add " + p.name + " to bag"}
                      disabled={p.stock <= (bag.items[p.id] || 0)}
                      onClick={() => change(p.id, (bag.items[p.id] || 0) + 1)}
                    >
                      +
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <p className="muted">{t("No products found.")}</p>
            )}
          </main>
        </>
      )}
      <footer className="foot">
        <b>{brand.name}</b>
        {choices.length > 0 && (
          <nav aria-label={t("Categories")}>
            {choices.map((c) => (
              <a
                key={c}
                href={categoryUrl(c)}
                onClick={(e) => {
                  if (
                    productId ||
                    e.ctrlKey ||
                    e.metaKey ||
                    e.shiftKey ||
                    e.altKey
                  )
                    return;
                  e.preventDefault();
                  find("");
                  pickCategory(c);
                  document.getElementById("catalog")?.scrollIntoView();
                }}
              >
                {catLabel(c)}
              </a>
            ))}
          </nav>
        )}
        {!!brand.socialLinks?.length && (
          <nav aria-label={t("Social media")}>
            {brand.socialLinks
              .filter((x) => /^https:\/\//i.test(x.url))
              .map((x, i) => (
                <SocialIcon key={i} item={x} />
              ))}
          </nav>
        )}
      </footer>
      {drawer && (
        <div className="overlay" onClick={() => open(false)}>
          <aside
            className="drawer"
            role="dialog"
            aria-label="Shopping bag"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawerHead">
              <h2>
                {t("Your bag")} ({count})
              </h2>
              <button className="secondary" onClick={() => open(false)}>
                {t("Close")}
              </button>
            </div>
            {items.map(({ id, p, qty }) => (
              <div className="cartItem" key={id}>
                <div>
                  <b>{p?.name || t("Unavailable product")}</b>
                  <NetSize product={p} />
                  <small>{p ? fmt(p.salePrice) + " " + t("each") : ""}</small>
                  {p?.promoLabel && (
                    <small>
                      {p.promoLabel} · {t("Save")}{" "}
                      {fmt((p.price - p.salePrice) * qty)}
                    </small>
                  )}
                  <div className="qty">
                    <button
                      aria-label={t("Decrease quantity")}
                      onClick={() => change(id, qty - 1)}
                    >
                      −
                    </button>
                    {qty}
                    <button
                      aria-label={t("Increase quantity")}
                      disabled={!p || qty >= p.stock}
                      onClick={() => change(id, qty + 1)}
                    >
                      +
                    </button>
                    <button className="remove" onClick={() => change(id, 0)}>
                      {t("Remove")}
                    </button>
                  </div>
                </div>
                <b>{fmt((p?.salePrice || 0) * qty)}</b>
              </div>
            ))}
            {!count && <p>{t("Your bag is empty.")}</p>}
            <div className="totals">
              <p>
                {t("Subtotal")}
                <b>{fmt(subCents / 100)}</b>
              </p>
              <p>
                {t("Shipping")} <b>{fmt(shipCents / 100)}</b>
              </p>
              <p>
                {t("Total")}
                <b>{fmt(total)}</b>
              </p>
            </div>
            {invalid && (
              <p role="alert">
                {t("Stock changed. Adjust the quantities in your bag.")}
              </p>
            )}
            {!checkout && (
              <button
                className="cta"
                disabled={!count || invalid}
                onClick={() => check(true)}
              >
                {t("Checkout")}
              </button>
            )}
            {checkout && (
              <form className="form" onSubmit={place}>
                <h3>{t("Delivery details")}</h3>
                {window.NW_LOCAL?.simulated && (
                  <p className="muted">
                    {t(
                      "Test checkout. Use sample details. This order is saved in this browser.",
                    )}
                  </p>
                )}
                {[
                  ["customerName", "Full name"],
                  ["phone", "Phone number"],
                  ["city", "Delivery city"],
                  ["address", "Delivery address"],
                ].map(([k, l]) => (
                  <Field key={k} label={t(l)} name={k} required />
                ))}
                <Select
                  label={t("Payment method")}
                  values={payments.map((x) => x.name)}
                  value={method?.name || ""}
                  onChange={(e) => selectPay(e.target.value)}
                />
                {method && (
                  <div className="paymentInfo">
                    <p>{method.details}</p>
                    {method.qr && <img src={method.qr} alt="Payment QR code" />}
                    {method.kind === "card" && (
                      <a target="_blank" rel="noreferrer" href={method.url}>
                        {t("Pay on the provider’s secure page")} ↗
                      </a>
                    )}
                    {method.kind !== "cod" && (
                      <Field
                        key={method.name}
                        label={t("Payment reference")}
                        name="paymentReference"
                        required
                      />
                    )}
                  </div>
                )}
                <button
                  className="cta"
                  disabled={a.busy || !count || invalid || !method}
                >
                  {t(a.busy ? "Placing order…" : "Place order")}
                </button>
                <Message text={a.message} />
              </form>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
