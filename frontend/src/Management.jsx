import ProductConfiguration from "./ProductConfiguration";
import {
  currentPath,
  currentTab,
  setTabLocation,
  link,
  local,
} from "./navigation";
import React, { useEffect, useState } from "react";

import { Header, Message, useAction, api, useTheme, exportJson } from "./ui";
import { LoginPage } from "./Accounts";
import Promotions from "./Promotions";
import { exportStorefront } from "./exportStorefront";
import Products from "./Products";
import Settings from "./Settings";
import { Orders, Detail } from "./Orders";

const tabs = {
  orders: "Orders Status",
  products: "Product Addition",
  details: "Product Details",
  promotions: "Promotions",
  shipping: "Courier Configuration",
  payments: "Payment Configurations",
  themes: "Themes & Appearance",
  store: "Store",
};
export function Admin({ settings, refresh, logout }) {
  const [tab, setTab] = useState(tabs[currentTab()] ? currentTab() : "orders");
  const [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]);
  const a = useAction();
  useTheme(settings.brand);
  const reloadProducts = async () => setProducts(await api("/admin/products"));
  const reloadOrders = async () => setOrders(await api("/admin/orders"));
  const id = currentPath().match(/^\/admin\/orders\/(\d+)\/?$/)?.[1];
  useEffect(() => {
    if (id) return;
    if (["products", "promotions", "details"].includes(tab))
      reloadProducts().catch((e) => a.setMessage(e.message));
    if (tab === "orders") reloadOrders().catch((e) => a.setMessage(e.message));
  }, [tab, id]);
  useEffect(() => {
    const cb = () => setTab(tabs[currentTab()] ? currentTab() : "orders");
    window.addEventListener("hashchange", cb);
    return () => window.removeEventListener("hashchange", cb);
  }, []);
  async function download() {
    const [products, orders] = await Promise.all([
      api("/admin/products"),
      api("/admin/orders"),
    ]);
    exportJson(settings.brand.slug + ".json", {
      products,
      orders,
      brand: settings.brand,
      config: settings.config,
    });
  }
  return (
    <>
      <Header brand={settings.brand}>
        <a
          href={link("/store/" + settings.brand.slug)}
          target="_blank"
          rel="noreferrer"
        >
          Open store ↗
        </a>
        <button onClick={logout}>Sign out</button>
      </Header>
      <main className="wrap">
        {id ? (
          <Detail id={id} settings={settings} />
        ) : (
          <>
            <div className="eyebrow">STORE MANAGEMENT</div>
            <h1>Admin dashboard</h1>
            <div className="tabs">
              {Object.entries(tabs).map(([k, label]) => (
                <button
                  key={k}
                  className={k === tab ? "on" : ""}
                  aria-pressed={k === tab}
                  onClick={() => {
                    setTabLocation(k);
                    setTab(k);
                  }}
                >
                  {label}
                </button>
              ))}
              <button onClick={() => a.run(download)}>Export data</button>
              <button
                onClick={() =>
                  a.run(async () =>
                    exportStorefront(
                      await api("/stores/" + settings.brand.slug),
                    ),
                  )
                }
              >
                Download GitHub storefront
              </button>
            </div>
            <Message text={a.message} />
            {tab === "products" ? (
              <Products products={products} reload={reloadProducts} />
            ) : tab === "details" ? (
              <ProductConfiguration
                products={products}
                reload={reloadProducts}
              />
            ) : tab === "promotions" ? (
              <Promotions products={products} reload={reloadProducts} />
            ) : tab === "orders" ? (
              <Orders orders={orders} reload={reloadOrders} />
            ) : (
              <Settings
                key={tab}
                tab={tab}
                settings={settings}
                reload={refresh}
              />
            )}
          </>
        )}
      </main>
    </>
  );
}
export function AccountPortal({ role, Dashboard }) {
  const [session, set] = useState(null),
    [ready, mark] = useState(false),
    [reason, explain] = useState("");
  useTheme(session?.brand);
  const load = async () => {
    const data = await api(
      role === "owner" ? "/owner/stores" : "/admin/settings",
    );
    set(role === "owner" ? true : data);
    explain("");
  };
  useEffect(() => {
    const lost = (e) => {
      set(null);
      explain(e.detail);
    };
    window.addEventListener("access-lost", lost);
    load()
      .catch((e) => explain(e.status === 401 ? "" : e.message))
      .finally(() => mark(true));
    return () => window.removeEventListener("access-lost", lost);
  }, [role]);
  useEffect(() => {
    if (!session || role === "owner") return;
    // Refresh access separately so an in-progress form keeps its original revision.
    const verify = () => api("/admin/access").catch(() => {});
    const t = setInterval(verify, 30000);
    window.addEventListener("focus", verify);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", verify);
    };
  }, [!!session, role]);
  async function logout() {
    try {
      await api("/auth/" + role + "/logout", "POST");
      set(null);
      explain("Signed out.");
    } catch (e) {
      explain(e.message);
    }
  }
  if (!ready) return <main className="wrap">Loading portal…</main>;
  if (!session) return <LoginPage role={role} reason={reason} onLogin={load} />;
  return (
    <>
      <Message text={reason} />
      <Dashboard settings={session} refresh={load} logout={logout} />
    </>
  );
}
