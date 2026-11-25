import StoreBrandFields from "./StoreBrandFields";
import PostExToken from "./PostExToken";
import { link, local } from "./navigation";
import React, { useState } from "react";
import { Field, Select, Message, ImageField, useAction, api } from "./ui";
import { themes } from "./themes";
export default function Settings({ tab, settings, reload }) {
  const [brand, setBrand] = useState(settings.brand),
    [cfg, setCfg] = useState(settings.config),
    [custom, rename] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const a = useAction();
  const patchBrand = (key, value) => setBrand((b) => ({ ...b, [key]: value }));
  const patch = (key, value) => setCfg((c) => ({ ...c, [key]: value }));
  function row(list, index, key, value) {
    setCfg((c) => ({
      ...c,
      [list]: c[list].map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    }));
  }
  async function save(e, type, value) {
    e?.preventDefault();
    if (videoBusy) return;
    await a.run(async () => {
      await api(
        "/admin/" + (type === "brand" ? "brand" : "settings"),
        "PUT",
        type === "brand"
          ? { ...value, version: settings.version }
          : { config: value, version: settings.version },
      );
      await reload();
      a.setMessage("Settings saved.");
    });
  }
  function add(list) {
    const name = custom.trim();
    if (
      !name ||
      cfg[list].some((x) => x.name.toLowerCase() === name.toLowerCase())
    ) {
      a.setMessage("Enter a unique name.");
      return;
    }
    patch(list, [
      ...cfg[list],
      list === "payments"
        ? { name, kind: "online", enabled: false, qr: "", url: "", details: "" }
        : { name, enabled: false, pickupCode: "", notes: "", apiUrl: "" },
    ]);
    rename("");
  }
  return (
    <>
      <Message text={a.message} />
      {tab === "store" ? (
        <section className="panel">
          <h3>Store branding</h3>
          <form className="form" onSubmit={(e) => save(e, "brand", brand)}>
            <Field
              label="Store name"
              value={brand.name}
              required
              maxLength={100}
              onChange={(e) => patchBrand("name", e.target.value)}
            />
            <Field
              label="Browser title"
              value={brand.browserTitle}
              required
              maxLength={120}
              onChange={(e) => patchBrand("browserTitle", e.target.value)}
            />
            <ImageField
              label="Store logo"
              value={brand.logo}
              onChange={(v) => patchBrand("logo", v)}
              error={a.setMessage}
            />
            <ImageField
              label="Store banner"
              value={brand.banner}
              onChange={(v) => patchBrand("banner", v)}
              error={a.setMessage}
            />
            <StoreBrandFields
              brand={brand}
              patch={patchBrand}
              onBusy={setVideoBusy}
            />
            <a href={link("/store/" + brand.slug)}>/store/{brand.slug}</a>
            <button disabled={a.busy || videoBusy} className="cta">
              Save branding
            </button>
          </form>
        </section>
      ) : tab === "themes" ? (
        <section className="panel">
          <h3>Store &amp; Admin Theme Gallery</h3>
          <div className="themeGrid">
            {themes.map((t) => (
              <button
                key={t.id}
                disabled={a.busy}
                className={
                  "themeChoice " +
                  (settings.brand.theme === t.id ? "selected" : "")
                }
                onClick={() => save(null, "brand", { ...brand, theme: t.id })}
                aria-pressed={settings.brand.theme === t.id}
              >
                <span className="swatches">
                  {t.colors.map((c) => (
                    <i key={c} style={{ background: c }} />
                  ))}
                </span>
                <span>
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : tab === "shipping" ? (
        <>
          <PostExToken settings={settings} />
          <form onSubmit={(e) => save(e, "config", cfg)} className="form">
            <section className="panel form">
              <h3>Shipping rate rules</h3>
              <p className="muted">
                The highest product shipping fee applies once. If every product
                fee is zero, the base fee applies. Each started kilogram above
                the included weight adds one extra charge.
              </p>
              {[
                ["baseCharge", "Default base charge (PKR)"],
                ["includedWeight", "Included shipment weight (kg)"],
                ["extraPerKg", "Extra charge per additional kg (PKR)"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  type="number"
                  step={k === "includedWeight" ? ".001" : ".01"}
                  min={k === "includedWeight" ? ".001" : 0}
                  required
                  value={cfg.shipping[k]}
                  onChange={(e) =>
                    patch("shipping", {
                      ...cfg.shipping,
                      [k]: e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              ))}
            </section>
            <section className="panel form">
              <h3>Courier providers</h3>
              <Select
                label="Default shipper"
                values={cfg.couriers
                  .filter((x) => x.enabled)
                  .map((x) => x.name)}
                value={cfg.defaultShipper}
                onChange={(e) => patch("defaultShipper", e.target.value)}
              />
              {cfg.couriers.map((c, i) => (
                <fieldset key={i}>
                  <legend>{c.name}</legend>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={(e) => {
                        const couriers = cfg.couriers.map((x, j) =>
                          j === i ? { ...x, enabled: e.target.checked } : x,
                        );
                        setCfg({
                          ...cfg,
                          couriers,
                          defaultShipper: couriers.some(
                            (x) => x.name === cfg.defaultShipper && x.enabled,
                          )
                            ? cfg.defaultShipper
                            : couriers.find((x) => x.enabled)?.name || "",
                        });
                      }}
                    />
                    Enable {c.name}
                  </label>
                  <Field
                    label="Pickup address code"
                    value={c.pickupCode}
                    onChange={(e) =>
                      row("couriers", i, "pickupCode", e.target.value)
                    }
                  />
                  {c.name !== "PostEx" && (
                    <Field
                      label="Courier API base URL (optional)"
                      type="url"
                      value={c.apiUrl || ""}
                      onChange={(e) =>
                        row("couriers", i, "apiUrl", e.target.value)
                      }
                    />
                  )}
                  <Field
                    label="Dispatch instructions"
                    value={c.notes}
                    onChange={(e) =>
                      row("couriers", i, "notes", e.target.value)
                    }
                  />
                </fieldset>
              ))}
              <div className="actions">
                <Field
                  label="Custom courier name"
                  value={custom}
                  onChange={(e) => rename(e.target.value)}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => add("couriers")}
                >
                  Add courier
                </button>
              </div>
            </section>
            <section className="panel form">
              <h3>WhatsApp confirmation</h3>
              <label className="check">
                <input
                  type="checkbox"
                  checked={cfg.whatsApp.enabled}
                  onChange={(e) =>
                    patch("whatsApp", {
                      ...cfg.whatsApp,
                      enabled: e.target.checked,
                    })
                  }
                />
                Show a WhatsApp confirmation link on order details
              </label>
              {[
                ["businessPhone", "Business phone"],
                ["phoneId", "Business phone ID"],
                ["template", "Template name"],
              ].map(([k, l]) => (
                <Field
                  key={k}
                  label={l}
                  value={cfg.whatsApp[k]}
                  onChange={(e) =>
                    patch("whatsApp", { ...cfg.whatsApp, [k]: e.target.value })
                  }
                />
              ))}
            </section>
            <button className="cta" disabled={a.busy}>
              Save shipping &amp; couriers
            </button>
          </form>
        </>
      ) : (
        <section className="panel">
          <h3>Payment methods</h3>
          <form className="form" onSubmit={(e) => save(e, "config", cfg)}>
            {cfg.payments.map((p, i) => (
              <fieldset key={i}>
                <legend>{p.name}</legend>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) =>
                      row("payments", i, "enabled", e.target.checked)
                    }
                  />
                  Enable {p.name}
                </label>
                <Field
                  label="Display name"
                  value={p.name}
                  required
                  onChange={(e) => row("payments", i, "name", e.target.value)}
                />
                <Field
                  label="Payment instructions / account details"
                  value={p.details}
                  onChange={(e) =>
                    row("payments", i, "details", e.target.value)
                  }
                />
                {p.kind === "card" && (
                  <Field
                    label="Hosted card payment link (HTTPS)"
                    type="url"
                    required={p.enabled}
                    value={p.url}
                    onChange={(e) => row("payments", i, "url", e.target.value)}
                  />
                )}
                <ImageField
                  label="Upload QR image"
                  value={p.qr}
                  onChange={(v) => row("payments", i, "qr", v)}
                  error={a.setMessage}
                />
                {!p.qr.startsWith("data:") && (
                  <Field
                    label="QR image URL (optional)"
                    value={p.qr}
                    type="url"
                    onChange={(e) => row("payments", i, "qr", e.target.value)}
                  />
                )}
              </fieldset>
            ))}
            <div className="actions">
              <Field
                label="Custom payment name"
                value={custom}
                onChange={(e) => rename(e.target.value)}
              />
              <button
                className="secondary"
                type="button"
                onClick={() => add("payments")}
              >
                Add payment method
              </button>
            </div>
            <button className="cta" disabled={a.busy}>
              Save payment settings
            </button>
          </form>
        </section>
      )}
    </>
  );
}
