import React, { useEffect, useState } from "react";
import { api, Field, Select, Message, money, useAction } from "./ui";
const offers = {
  None: { promoKind: "None", promoValue: 0, promoLabel: "" },
  "10% off": { promoKind: "Percent", promoValue: 10, promoLabel: "10% off" },
  "20% off": { promoKind: "Percent", promoValue: 20, promoLabel: "20% off" },
  "PKR 100 off": {
    promoKind: "Fixed",
    promoValue: 100,
    promoLabel: "PKR 100 off",
  },
  "Custom percentage": { promoKind: "Percent", promoValue: "", promoLabel: "" },
  "Custom amount": { promoKind: "Fixed", promoValue: "", promoLabel: "" },
};
function selection(p) {
  if (p.promoKind === "None") return "None";
  const named = offers[p.promoLabel];
  if (
    named &&
    named.promoKind === p.promoKind &&
    named.promoValue === Number(p.promoValue)
  )
    return p.promoLabel;
  return p.promoKind === "Percent" ? "Custom percentage" : "Custom amount";
}
export function PromotionFields({ product: p, onChange }) {
  const [choice, setChoice] = useState(() => selection(p));
  useEffect(() => setChoice(selection(p)), [p.id, p.version, p.promoKind]);
  const custom = choice.startsWith("Custom");
  const amount = Number(p.promoValue) || 0;
  const price = Math.round(Number(p.price || 0) * 100),
    discounted =
      p.promoKind === "Percent"
        ? Math.round((price * (10000 - Math.round(amount * 100))) / 10000)
        : p.promoKind === "Fixed"
          ? price - Math.round(amount * 100)
          : price;
  return (
    <>
      <Select
        label="Promotion"
        values={Object.keys(offers)}
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
          onChange({ ...p, ...offers[e.target.value] });
        }}
      />
      {custom && (
        <>
          <Field
            label="Promotion label"
            required
            maxLength={100}
            value={p.promoLabel}
            onChange={(e) => onChange({ ...p, promoLabel: e.target.value })}
          />
          <Field
            label={
              p.promoKind === "Percent" ? "Discount (%)" : "Discount (PKR)"
            }
            type="number"
            min=".01"
            step=".01"
            max={p.promoKind === "Percent" ? 100 : p.price}
            required
            value={p.promoValue}
            onChange={(e) => onChange({ ...p, promoValue: e.target.value })}
          />
        </>
      )}
      {Number(p.price) > 0 && (
        <div className="pricePreview">
          <span>
            Regular price <b>{money(p.price)}</b>
          </span>
          <span>
            Promotional price <b>{money(Math.max(0, discounted) / 100)}</b>
          </span>
        </div>
      )}
    </>
  );
}
function Editor({ product, reload }) {
  const [p, set] = useState(product);
  const a = useAction();
  async function save(e) {
    e.preventDefault();
    await a.run(async () => {
      await api("/admin/products/" + p.id, "PUT", {
        ...p,
        promoValue: Number(p.promoValue),
      });
      await reload(
        p.promoKind === "None"
          ? "Promotion removed from " + p.name + "."
          : "Promotion applied to " + p.name + ".",
      );
    });
  }
  return (
    <form className="form" onSubmit={save}>
      <PromotionFields product={p} onChange={set} />
      <Message text={a.message} />
      <button className="cta" disabled={a.busy}>
        Save promotion
      </button>
    </form>
  );
}
export default function Promotions({ products, reload }) {
  const [id, select] = useState(""),
    [message, say] = useState("");
  const selected = products.find((p) => String(p.id) === id) || products[0];
  return (
    <section className="panel">
      <h2>Product promotions</h2>
      <Message text={message} />
      {selected ? (
        <>
          <label>
            Product to promote
            <select
              aria-label="Product to promote"
              value={selected.id}
              onChange={(e) => {
                select(e.target.value);
                say("");
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Editor
            key={selected.id + ":" + selected.version}
            product={selected}
            reload={async (msg) => {
              await reload();
              say(msg);
            }}
          />
          <h3>Current offers</h3>
          {products.some((p) => p.promoKind !== "None") ? (
            products
              .filter((p) => p.promoKind !== "None")
              .map((p) => (
                <div className="row" key={p.id}>
                  <div>
                    <b>{p.name}</b>
                    <small>{p.promoLabel}</small>
                  </div>
                  <span>
                    <del>{money(p.price)}</del> <b>{money(p.salePrice)}</b>
                  </span>
                </div>
              ))
          ) : (
            <p>No active offers.</p>
          )}
        </>
      ) : (
        <p>Add a product in Product Addition to apply a promotion.</p>
      )}
    </section>
  );
}
