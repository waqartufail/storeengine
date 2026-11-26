import NetSize from "./NetSize";
import { CoverPhoto } from "./ProductMedia";
import { PromotionFields } from "./Promotions";
import React, { useState } from "react";
import { api, Field, Select, Message, useAction, money } from "./ui";
const blank = {
  name: "",
  description: "",
  category: "General",
  price: "",
  stock: 0,
  netQuantity: "",
  netUnit: "g",
  weightKg: 0.5,
  shippingCharge: 0,
  imageUrl: "",
  promoKind: "None",
  promoValue: 0,
  promoLabel: "",
  version: 0,
};
export default function Products({ products, reload }) {
  const [p, set] = useState({ ...blank }),
    [name, find] = useState(""),
    [stock, filter] = useState("All");
  const a = useAction();
  const [mediaBusy, setMediaBusy] = useState(false);
  function edit(row) {
    setMediaBusy(false);
    set({
      ...row,
      netQuantity: row.netQuantity ?? "",
      netUnit: row.netUnit || "g",
    });
    document
      .querySelector("#product-editor")
      ?.scrollIntoView({ block: "start" });
  }
  function field(key, label, props = {}) {
    return (
      <Field
        label={label}
        value={p[key]}
        {...props}
        onChange={(e) => set({ ...p, [key]: e.target.value })}
      />
    );
  }
  async function save(e) {
    e.preventDefault();
    if (mediaBusy) return;
    await a.run(async () => {
      const payload = {
        ...p,
        netQuantity: p.netQuantity === "" ? null : Number(p.netQuantity),
        netUnit: p.netQuantity === "" ? "" : p.netUnit,
      };
      for (const k of [
        "price",
        "stock",
        "weightKg",
        "shippingCharge",
        "promoValue",
      ])
        payload[k] = Number(payload[k]);
      await api(
        "/admin/products" + (p.id ? "/" + p.id : ""),
        p.id ? "PUT" : "POST",
        payload,
      );
      await reload();
      edit(blank);
      a.setMessage("Product saved.");
    });
  }
  async function remove(row) {
    if (!confirm("Remove " + row.name + " from the store catalog?")) return;
    await a.run(async () => {
      await api(
        "/admin/products/" + row.id + "?version=" + row.version,
        "DELETE",
      );
      if (p.id === row.id) edit(blank);
      await reload();
      a.setMessage("Product removed.");
    });
  }
  const filtered = products.filter(
    (x) =>
      x.name.toLowerCase().includes(name.toLowerCase()) &&
      (stock === "All" || (stock === "In Stock") === x.stock > 0),
  );
  return (
    <>
      <Message text={a.message} />
      <div className="adminGrid">
        <section id="product-editor" className="panel">
          <h3>{p.id ? "Edit product" : "Add a product"}</h3>
          <form className="form" onSubmit={save}>
            {field("name", "Product name", { required: true, maxLength: 160 })}
            {field("description", "Description")}
            {field("category", "Category", {
              required: true,
              maxLength: 1000,
              placeholder: "Honey, Gifts, Pantry",
            })}
            <small>Separate categories with commas.</small>
            {field("price", "Price (PKR)", {
              type: "number",
              step: ".01",
              min: ".01",
              required: true,
            })}
            {field("stock", "Stock quantity", {
              type: "number",
              min: 0,
              required: true,
            })}
            <fieldset>
              <legend>Product size shown to customers</legend>
              <div className="pair">
                {field("netQuantity", "Net quantity", {
                  type: "number",
                  min: ".001",
                  max: "10000000",
                  step: ".001",
                  placeholder: "e.g. 250",
                })}
                <Select
                  label="Product unit"
                  values={["g", "ml"]}
                  value={p.netUnit}
                  onChange={(e) => set({ ...p, netUnit: e.target.value })}
                />
              </div>
            </fieldset>
            {field("weightKg", "Packed shipping weight (kg)", {
              type: "number",
              step: ".001",
              min: ".001",
              required: true,
            })}
            <small>
              Include the packaging in this weight. Checkout uses it to
              calculate delivery.
            </small>
            {field("shippingCharge", "Shipping charge (PKR)", {
              type: "number",
              step: ".01",
              min: 0,
              required: true,
            })}
            <CoverPhoto
              key={p.id || "new"}
              value={p.imageUrl}
              onBusy={setMediaBusy}
              onChange={(imageUrl) =>
                set((current) => ({ ...current, imageUrl }))
              }
            />
            <PromotionFields key={p.id || "new"} product={p} onChange={set} />
            <button className="cta" disabled={a.busy || mediaBusy}>
              Save product
            </button>
            {p.id && (
              <button
                type="button"
                className="secondary"
                onClick={() => edit(blank)}
              >
                Cancel editing
              </button>
            )}
          </form>
        </section>
        <section className="panel">
          <h3>
            Product stock ({filtered.length} / {products.length})
          </h3>
          <div className="adminFilters pair">
            <Field
              label="Product Name"
              placeholder="Search product"
              value={name}
              onChange={(e) => find(e.target.value)}
            />
            <Select
              label="Stock status"
              values={["All", "In Stock", "Out of Stock"]}
              value={stock}
              onChange={(e) => filter(e.target.value)}
            />
            <button
              className="cta"
              onClick={() => {
                find("");
                filter("All");
              }}
            >
              Clear filters
            </button>
          </div>
          {filtered.map((x) => (
            <div className="row productRow" key={x.id} onClick={() => edit(x)}>
              <button
                className="record"
                onClick={(e) => {
                  e.stopPropagation();
                  edit(x);
                }}
              >
                <b>{x.name}</b>
                <NetSize product={x} />
                {x.promoLabel && (
                  <small>
                    {x.promoLabel} · <del>{money(x.price)}</del>
                  </small>
                )}
                <small>
                  {money(x.salePrice)} · Stock {x.stock} · Packed {x.weightKg}{" "}
                  kg · Shipping {money(x.shippingCharge)}
                </small>
                <span className="statusPill">
                  {x.stock ? "In Stock" : "Out of Stock"}
                </span>
              </button>
              <button
                className="remove"
                disabled={a.busy}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(x);
                }}
              >
                Remove
              </button>
            </div>
          ))}
          {!filtered.length && (
            <p className="muted">No products match these filters.</p>
          )}
        </section>
      </div>
    </>
  );
}
