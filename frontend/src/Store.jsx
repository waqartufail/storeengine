import StoreBanner from "./StoreBanner";
import ProductPage, { ProductPhoto } from "./ProductPage";
import { link, logo, scrollToCatalog } from "./navigation";
import React, { useEffect, useState } from "react";
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
  const [category, cat] = useState("All"),
    [search, find] = useState(""),
    [pay, selectPay] = useState(""),
    [receipt, accept] = useState(() => storedReceipt(receiptKey));
  const a = useAction();
  useTheme(data?.brand);
  async function load() {
    try {
      set(await api(path));
      fail("");
    } catch (e) {
      set(null);
      fail(e.message);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    window.addEventListener("focus", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", load);
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
            <span className="eyebrow">ORDER CONFIRMATION</span>
            <h1>Thank you for your order!</h1>
            <p>Your order has been placed.</p>
            <p className="orderNumber">
              Order number <strong>#{receipt.id}</strong>
            </p>
            <div className="totals">
              <p>
                Subtotal <b>{money(receipt.subtotal)}</b>
              </p>
              <p>
                Shipping <b>{money(receipt.shipping)}</b>
              </p>
              <p>
                Total <b>{money(receipt.total)}</b>
              </p>
              <p>
                Payment method <b>{receipt.paymentMethod}</b>
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
              Continue shopping
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
          <h1>{failure || "Loading store…"}</h1>
          <a href={link("/store")}>Store directory</a>
        </main>
      </>
    );
  const { products, brand, shipping, payments } = data;
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
  const filtered = products.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
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
          Shop
        </a>
        <button onClick={() => open(true)}>Bag ({count})</button>
      </Header>
      {productId ? (
        <ProductPage
          key={productId}
          product={products.find((p) => p.id === Number(productId))}
          brand={brand}
          slug={slug}
          products={products}
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
                Good things.
                <br />
                <em>Better living.</em>
              </h1>
              <p>
                Discover useful, well-designed essentials for your everyday
                life.
              </p>
              <a className="cta" href="#catalog" onClick={scrollToCatalog}>
                Explore collection →
              </a>
            </div>
            <div className="heroImg">
              <StoreBanner brand={brand} />
            </div>
          </section>
          <main className="wrap" id="catalog">
            <div className="head">
              <div>
                <div className="eyebrow">THE COLLECTION</div>
                <h2>Shop essentials</h2>
              </div>
              <input
                className="search"
                aria-label="Search products"
                placeholder="Search products..."
                value={search}
                onChange={(e) => find(e.target.value)}
              />
            </div>
            <div className="filters">
              {["All", ...new Set(products.map((p) => p.category))].map((c) => (
                <button
                  className={category === c ? "on" : ""}
                  key={c}
                  onClick={() => cat(c)}
                >
                  {c}
                </button>
              ))}
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
                      <span>{p.category}</span>
                      <span>
                        {p.stock ? p.stock + " available" : "Out of stock"}
                      </span>
                    </div>
                    <h3>
                      <a href={link("/store/" + slug + "/products/" + p.id)}>
                        {p.name}
                      </a>
                    </h3>
                    <p>{p.description}</p>
                    {p.promoLabel && (
                      <p>
                        <span className="statusPill">{p.promoLabel}</span>{" "}
                        <del>{money(p.price)}</del>
                      </p>
                    )}
                    <strong>{money(p.salePrice)}</strong>
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
            {!filtered.length && <p className="muted">No products found.</p>}
          </main>
        </>
      )}
      <footer className="foot">
        <b>{brand.name}</b>
        {!!brand.socialLinks?.length && (
          <nav aria-label="Social media">
            {brand.socialLinks
              .filter((x) => /^https:\/\//i.test(x.url))
              .map((x, i) => (
                <a
                  key={i}
                  href={x.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {x.label}
                </a>
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
              <h2>Your bag ({count})</h2>
              <button className="secondary" onClick={() => open(false)}>
                Close
              </button>
            </div>
            {items.map(({ id, p, qty }) => (
              <div className="cartItem" key={id}>
                <div>
                  <b>{p?.name || "Unavailable product"}</b>
                  <small>{p ? money(p.salePrice) + " each" : ""}</small>
                  {p?.promoLabel && (
                    <small>
                      {p.promoLabel} · Save{" "}
                      {money((p.price - p.salePrice) * qty)}
                    </small>
                  )}
                  <div className="qty">
                    <button
                      aria-label="Decrease quantity"
                      onClick={() => change(id, qty - 1)}
                    >
                      −
                    </button>
                    {qty}
                    <button
                      aria-label="Increase quantity"
                      disabled={!p || qty >= p.stock}
                      onClick={() => change(id, qty + 1)}
                    >
                      +
                    </button>
                    <button className="remove" onClick={() => change(id, 0)}>
                      Remove
                    </button>
                  </div>
                </div>
                <b>{money((p?.salePrice || 0) * qty)}</b>
              </div>
            ))}
            {!count && <p>Your bag is empty.</p>}
            <div className="totals">
              <p>
                Subtotal <b>{money(subCents / 100)}</b>
              </p>
              <p>
                Shipping · {grams / 1000} kg <b>{money(shipCents / 100)}</b>
              </p>
              <p>
                Total <b>{money(total)}</b>
              </p>
            </div>
            {invalid && (
              <p role="alert">
                Stock changed. Adjust the quantities in your bag.
              </p>
            )}
            {!checkout && (
              <button
                className="cta"
                disabled={!count || invalid}
                onClick={() => check(true)}
              >
                Checkout
              </button>
            )}
            {checkout && (
              <form className="form" onSubmit={place}>
                <h3>Delivery details</h3>
                {window.NW_LOCAL?.simulated && (
                  <p className="muted">
                    Test checkout. Use sample details. This order is saved in
                    this browser.
                  </p>
                )}
                {[
                  ["customerName", "Full name"],
                  ["phone", "Phone number"],
                  ["city", "Delivery city"],
                  ["address", "Delivery address"],
                ].map(([k, l]) => (
                  <Field key={k} label={l} name={k} required />
                ))}
                <Select
                  label="Payment method"
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
                        Pay on the provider’s secure page ↗
                      </a>
                    )}
                    {method.kind !== "cod" && (
                      <Field
                        key={method.name}
                        label="Payment reference"
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
                  {a.busy ? "Placing order…" : "Place order"}
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
