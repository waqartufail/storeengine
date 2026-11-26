import NetSize from "./NetSize";
import { link, local } from "./navigation";
import React, { useState, useEffect } from "react";
import {
  api,
  Field,
  Select,
  Message,
  money,
  dayLocal,
  statuses,
  useAction,
} from "./ui";
const empty = { number: "", product: "", from: "", to: "", status: "All" };
export function Orders({ orders, reload }) {
  const [f, set] = useState(empty);
  const a = useAction();
  const change = (k, v) => set({ ...f, [k]: v });
  const filtered = orders.filter(
    (o) =>
      String(o.id).includes(f.number.replace(/^#/, "")) &&
      o.items.some((i) =>
        i.productName.toLowerCase().includes(f.product.toLowerCase()),
      ) &&
      (!f.from || dayLocal(o.createdAt) >= f.from) &&
      (!f.to || dayLocal(o.createdAt) <= f.to) &&
      (f.status === "All" || o.status === f.status),
  );
  return (
    <section className="panel">
      <h3>
        Orders Status ({filtered.length} / {orders.length})
      </h3>
      <Message text={a.message} />
      <div className="adminFilters">
        {[
          ["number", "Order No", "text"],
          ["product", "Product", "text"],
          ["from", "From date", "date"],
          ["to", "To date", "date"],
        ].map(([k, l, t]) => (
          <Field
            key={k}
            label={l}
            type={t}
            value={f[k]}
            onChange={(e) => change(k, e.target.value)}
          />
        ))}
        <Select
          label="Status"
          values={["All", ...statuses]}
          value={f.status}
          onChange={(e) => change("status", e.target.value)}
        />
        <button className="cta" onClick={() => set(empty)}>
          Clear filters
        </button>
      </div>
      {filtered.map((o) => (
        <div className="row" key={o.id}>
          <div>
            <a className="orderLink" href={link("/admin/orders/" + o.id)}>
              Order #{o.id} · {o.customerName}
            </a>
            <small>
              {new Date(o.createdAt).toLocaleString()} · {o.city} ·{" "}
              {o.paymentMethod} · {money(o.total)}
            </small>
            <small>
              {o.items
                .map((x) => x.productName + " × " + x.quantity)
                .join(", ")}
            </small>
          </div>
          <select
            aria-label={"Status for order " + o.id}
            value={o.status}
            disabled={a.busy}
            onChange={(e) =>
              a.run(async () => {
                await api("/admin/orders/" + o.id + "/status", "PATCH", {
                  status: e.target.value,
                });
                await reload();
              })
            }
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      ))}
      {!filtered.length && (
        <p className="muted">No orders match these filters.</p>
      )}
    </section>
  );
}
export function Detail({ id, settings }) {
  const [o, set] = useState(null),
    [tracking, track] = useState("");
  const a = useAction();
  const path = "/admin/orders/" + id;
  const load = async () => set(await api(path));
  useEffect(() => {
    a.run(load);
  }, [id]);
  useEffect(() => {
    if (!["Queued", "Sending"].includes(o?.booking)) return;
    const timer = setInterval(
      () => load().catch((e) => a.setMessage(e.message)),
      4000,
    );
    return () => clearInterval(timer);
  }, [o?.booking, id]);
  const action = (url, body, method = "POST") =>
    a.run(async () => {
      await api(path + "/" + url, method, body);
      await load();
    });
  const review =
    o?.booking === "Review" ||
    (o?.booking === "Sending" &&
      Date.now() - Date.parse(o.bookingStarted) > 120000);
  const digits = o?.phone.replace(/\D/g, "").replace(/^0/, "92");
  return (
    <>
      <a href={link("/admin#orders")}>← All orders</a>
      <Message text={a.message} />
      {o && (
        <>
          <h1>Order #{o.id}</h1>
          <div className="authGrid">
            <section className="panel">
              <h3>Delivery</h3>
              <p>
                {o.customerName}
                <br />
                {o.phone}
                <br />
                {o.address}
                <br />
                {o.city}
              </p>
              <p>{new Date(o.createdAt).toLocaleString()}</p>
              <Select
                label="Order status"
                value={o.status}
                values={statuses}
                onChange={(e) =>
                  action("status", { status: e.target.value }, "PATCH")
                }
              />
            </section>
            <section className="panel">
              <h3>Payment</h3>
              <p>
                {o.paymentMethod} ·{" "}
                {o.isCod
                  ? "Collect on delivery"
                  : o.paymentVerified
                    ? "Verified by admin"
                    : "Awaiting verification"}
              </p>
              {o.paymentReference && <p>Reference {o.paymentReference}</p>}
              {!o.isCod && !o.paymentVerified && (
                <button
                  className="secondary"
                  disabled={a.busy}
                  onClick={() =>
                    confirm(
                      "Have you verified receipt with the payment provider?",
                    ) && action("verify-payment")
                  }
                >
                  Mark payment verified
                </button>
              )}
            </section>
          </div>
          <section className="panel">
            <h3>Items</h3>
            {o.items.map((i) => (
              <div className="row" key={i.id}>
                <div>
                  <b>{i.productName}</b>
                  <NetSize product={i} />
                  <small>
                    {i.quantity} × {money(i.unitPrice)}{" "}
                    {i.promoLabel &&
                      "· " +
                        i.promoLabel +
                        " (list " +
                        money(i.listPrice) +
                        ")"}
                  </small>
                </div>
                <b>{money(i.quantity * i.unitPrice)}</b>
              </div>
            ))}
            <div className="totals">
              <p>
                Subtotal <b>{money(o.subtotal)}</b>
              </p>
              <p>
                Shipping <b>{money(o.shipping)}</b>
              </p>
              <p>
                Total <b>{money(o.total)}</b>
              </p>
            </div>
          </section>
          <section className="panel form">
            <h3>Shipment</h3>
            <p>
              {o.courier || "Unassigned"} · {o.booking}
              {o.tracking && " · " + o.tracking}
            </p>
            {local && o.courier === "PostEx" && (
              <small>
                Live PostEx booking is available in the server edition. You can
                record a tracking number below.
              </small>
            )}
            {!local && o.courier === "PostEx" && o.booking === "Unbooked" && (
              <button
                className="cta"
                disabled={
                  a.busy ||
                  (!o.isCod && !o.paymentVerified) ||
                  ["Delivered", "Cancelled"].includes(o.status)
                }
                onClick={() =>
                  confirm("Submit this shipment to PostEx?") && action("book")
                }
              >
                Book with PostEx
              </button>
            )}
            {(review || o.booking === "Unbooked") && (
              <>
                <Field
                  label="Verified courier tracking number"
                  value={tracking}
                  onChange={(e) => track(e.target.value)}
                />
                <button
                  className="secondary"
                  disabled={a.busy || !tracking.trim()}
                  onClick={() =>
                    action("tracking", { tracking, confirmUnbooked: false })
                  }
                >
                  Save tracking number
                </button>
              </>
            )}
            {review && (
              <>
                <p>
                  Check the merchant portal for reference NW-{settings.id}-
                  {o.id} before retrying.
                </p>
                <button
                  className="secondary"
                  onClick={() =>
                    confirm(
                      "Has the courier confirmed this shipment was never booked?",
                    ) &&
                    action("tracking", { tracking: "", confirmUnbooked: true })
                  }
                >
                  Confirm no booking exists
                </button>
              </>
            )}
            {settings.config.whatsApp.enabled && (
              <a
                href={
                  "https://wa.me/" +
                  digits +
                  "?text=" +
                  encodeURIComponent(
                    settings.brand.name +
                      " confirms order #" +
                      o.id +
                      " for " +
                      money(o.total) +
                      ".",
                  )
                }
                target="_blank"
                rel="noreferrer"
              >
                Open WhatsApp confirmation
              </a>
            )}
          </section>
        </>
      )}
    </>
  );
}
