import React, { useState } from "react";
import { local } from "./navigation";
import { Field, Message, useAction, api } from "./ui";
import { exportStorefront } from "./exportStorefront";
export default function PublishStore({ brand }) {
  const [origin, setOrigin] = useState(local ? "" : location.origin),
    [slug, setSlug] = useState(local ? "" : brand.slug);
  const a = useAction();
  let host = "";
  try {
    const url = new URL(origin.trim());
    if (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
      host = url.origin;
  } catch {}
  const valid = host && /^[a-z0-9-]+$/.test(slug);
  const shared = valid ? host + "/store/" + slug : "";
  return (
    <section className="panel form">
      <h2>Publish &amp; sync</h2>
      <p>
        {local
          ? "This Admin is a browser-only demo. To share edits and orders across devices, manage your catalog in the hosted Admin. A downloaded snapshot contains the catalog at export time."
          : "This Admin saves to the shared database. Give mobile shoppers the store link below. Changes refresh automatically while their store is open."}
      </p>
      <Field
        label="Hosted store origin"
        type="url"
        value={origin}
        placeholder="https://shop.example.com"
        onChange={(e) => setOrigin(e.target.value)}
      />
      {host && <a href={host + "/admin"}>Open hosted Admin</a>}
      <Field
        label="Approved store slug"
        value={slug}
        onChange={(e) => setSlug(e.target.value.trim())}
      />
      {shared && (
        <a href={shared} target="_blank" rel="noreferrer">
          {shared}
        </a>
      )}
      {host &&
        /^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(host).hostname) && (
          <p>
            On a phone, use the server’s public address or its LAN IP on the
            same Wi-Fi. Localhost points to the phone.
          </p>
        )}
      <p>
        For GitHub Pages, set Pages__Origin on the server to your Pages origin
        and publish the connected index.html once. Use an HTTPS API reachable by
        shoppers.
      </p>
      <button
        className="cta"
        disabled={!valid || a.busy}
        onClick={() =>
          a.run(async () => {
            if (
              !host.startsWith("https://") &&
              !["127.0.0.1", "localhost"].includes(new URL(host).hostname)
            )
              throw Error("GitHub Pages requires an HTTPS server.");
            await exportStorefront(null, { apiOrigin: host, slug });
            a.setMessage("Connected index.html downloaded.");
          })
        }
      >
        Download connected GitHub storefront
      </button>
      <button
        className="secondary"
        disabled={a.busy}
        onClick={() =>
          a.run(async () => {
            const catalog = await api("/stores/" + brand.slug);
            await exportStorefront(catalog);
            a.setMessage(
              "Snapshot downloaded. Publish this index.html again after your next edit.",
            );
          })
        }
      >
        Download offline catalog snapshot
      </button>
      <Message text={a.message} />
    </section>
  );
}
