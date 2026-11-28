import { DescriptionEditor } from "./Description";
import React, { useState } from "react";
import { api, Message, useAction } from "./ui";
import { CoverPhoto, GalleryEditor } from "./ProductMedia";
export default function ProductConfiguration({ products, reload }) {
  const [id, select] = useState(""),
    [saved, notice] = useState("");
  const p = products.find((x) => String(x.id) === id) || products[0];
  return (
    <section className="panel">
      <h2>Product detail configuration</h2>
      <Message text={saved} />
      {p ? (
        <>
          <label>
            Product to configure
            <select
              value={p.id}
              onChange={(e) => {
                select(e.target.value);
                notice("");
              }}
            >
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <Editor
            key={p.id + ":" + p.version}
            product={p}
            saved={async () => {
              await reload();
              notice("Product details saved for " + p.name + ".");
            }}
          />
        </>
      ) : (
        <p>Add a product in Product Addition to configure its detail page.</p>
      )}
    </section>
  );
}
function Editor({ product, saved }) {
  const [details, describe] = useState(
      (product.details || "").replace(/\r\n/g, "\n"),
    ),
    [disclosures, setDisclosures] = useState(product.disclosures || ""),
    [cover, setCover] = useState(product.imageUrl || ""),
    [photos, setPhotos] = useState(product.gallery || []),
    [busy, setBusy] = useState(false),
    [coverBusy, setCoverBusy] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const a = useAction();
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || coverBusy || tableOpen) return;
        a.run(async () => {
          await api("/admin/products/" + product.id, "PUT", {
            ...product,
            details,
            disclosures,
            imageUrl: cover,
            gallery: photos,
          });
          await saved();
        });
      }}
    >
      <DescriptionEditor
        value={details}
        onChange={describe}
        onTableOpen={setTableOpen}
      />
      <label>
        Product disclosures
        <textarea
          value={disclosures}
          maxLength={5000}
          rows={4}
          onChange={(e) => setDisclosures(e.target.value)}
          placeholder="For example: allergens, condition, warranty, or care instructions."
        />
      </label>
      <CoverPhoto value={cover} onChange={setCover} onBusy={setCoverBusy} />
      <GalleryEditor photos={photos} onChange={setPhotos} onBusy={setBusy} />
      <Message text={a.message} />
      <button
        className="cta"
        disabled={a.busy || busy || coverBusy || tableOpen}
      >
        Save product details
      </button>
    </form>
  );
}
