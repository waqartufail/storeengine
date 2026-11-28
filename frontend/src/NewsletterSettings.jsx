import React, { useState } from "react";
import { Field, Message, api, useAction } from "./ui";
import { defaultOffer } from "./newsletterRule";
export default function NewsletterSettings({ settings, refresh }) {
  const [rule, set] = useState({
      ...defaultOffer,
      ...settings.config.newsletter,
    }),
    [rows, show] = useState(null);
  const a = useAction(),
    patch = (key, value) => set((r) => ({ ...r, [key]: value }));
  return (
    <section className="panel">
      <h2>Newsletter welcome discount</h2>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          a.run(async () => {
            await api("/admin/newsletter-rule", "PUT", {
              version: settings.version,
              rule,
            });
            await refresh();
            a.setMessage("Newsletter rule saved.");
          });
        }}
      >
        <label className="check">
          <input
            type="checkbox"
            checked={rule.enabled}
            onChange={(e) => patch("enabled", e.target.checked)}
          />
          Enable newsletter promotion
        </label>
        <Field
          label="Welcome discount (%)"
          type="number"
          min="1"
          max="100"
          required
          value={rule.percent}
          onChange={(e) => patch("percent", Number(e.target.value))}
        />
        <Field
          label="Minimum product subtotal (PKR)"
          type="number"
          min="0"
          step=".01"
          required
          value={rule.minimum}
          onChange={(e) => patch("minimum", Number(e.target.value))}
        />
        <p>
          One redemption per subscribed email in this store. The percentage
          applies after product promotions and before shipping.
        </p>
        <Field
          label="Google web client ID"
          value={rule.googleClientId}
          placeholder="…apps.googleusercontent.com"
          onChange={(e) => patch("googleClientId", e.target.value.trim())}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={rule.googleOnly}
            onChange={(e) => patch("googleOnly", e.target.checked)}
          />
          Require Google sign-in to claim the offer
        </label>
        <button className="cta" disabled={a.busy}>
          Save newsletter rule
        </button>
      </form>
      <button
        className="secondary"
        disabled={a.busy}
        onClick={() => a.run(async () => show(await api("/admin/subscribers")))}
      >
        View subscribers
      </button>
      {rows && (
        <div>
          {rows.length ? (
            rows.map((x) => (
              <p key={x.email}>
                {x.email} · {x.used ? "Redeemed" : "Subscribed"}
              </p>
            ))
          ) : (
            <p>No subscribers yet.</p>
          )}
        </div>
      )}
      <Message text={a.message} />
    </section>
  );
}
