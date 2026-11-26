import NetSize from "./NetSize";
import { categories } from "./categories";
import { Description } from "./Description";
import { rememberProduct, suggest } from "./suggestions";
import React, { useEffect, useState } from "react";
import { money } from "./ui";
import { link, logo } from "./navigation";
export function ProductPhoto({ sources, alt, className = "" }) {
  const [failed, setFailed] = useState([]);
  const src = sources.find((s) => s && !failed.includes(s));
  if (!src) return <span className="photoMissing">Photo unavailable</span>;
  return (
    <img
      className={className}
      src={src}
      referrerPolicy="no-referrer"
      alt={alt}
      onError={() => setFailed((list) => [...list, src])}
    />
  );
}
export default function ProductPage({
  product: p,
  brand,
  slug,
  products,
  historyKey,
  t,
  fmt,
  catLabel,
  bag,
  quantity,
  add,
}) {
  const [selected, choose] = useState(0);
  const [recent, setRecent] = useState([]);
  useEffect(() => {
    if (p) setRecent(rememberProduct(historyKey, p.id));
  }, [historyKey, p?.id]);
  const back = link("/store/" + slug);
  if (!p)
    return (
      <main className="wrap">
        <h1>{t("Product unavailable")}</h1>
        <a href={back}>{t("Back to store")}</a>
      </main>
    );
  const suggested = suggest(products, p, recent, bag);
  const photos = [
    ...new Set([p.imageUrl, ...(p.gallery || [])].filter(Boolean)),
  ];
  const index = Math.min(selected, Math.max(0, photos.length - 1));
  return (
    <main className="wrap">
      <a href={back}>← {t("Back to store")}</a>
      <div className="detailGrid">
        <section>
          <div className="detailPhoto">
            <ProductPhoto
              sources={[photos[index], ...photos, brand.logo, logo]}
              alt={p.name}
            />
          </div>
          {photos.length > 1 && (
            <div className="thumbnails" aria-label="Product gallery">
              {photos.map((src, i) => (
                <button
                  key={src}
                  aria-label={t("View photo") + " " + (i + 1)}
                  aria-pressed={index === i}
                  onClick={() => choose(i)}
                >
                  <ProductPhoto sources={[src]} alt={"Photo " + (i + 1)} />
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="panel">
          <span className="eyebrow">
            {categories(p.category).map(catLabel).join(", ")}
          </span>
          <h1>{p.name}</h1>
          <NetSize product={p} />
          <p>{p.description}</p>
          {p.promoLabel && (
            <p>
              <span className="statusPill">{p.promoLabel}</span>{" "}
              <del>{fmt(p.price)}</del>
            </p>
          )}
          <h2>{fmt(p.salePrice)}</h2>
          <p>{p.stock ? p.stock + " " + t("available") : t("Out of stock")}</p>
          <button className="cta" disabled={p.stock <= quantity} onClick={add}>
            {t("Add to bag")}
          </button>
          {p.details && (
            <>
              <h3>{t("Product details")}</h3>
              <Description text={p.details} />
            </>
          )}
        </section>
      </div>
      {suggested.length > 0 && (
        <section className="suggestions" aria-label="Suggested products">
          <h2>{t("You may also like")}</h2>
          <div className="suggestGrid">
            {suggested.map((x) => (
              <a
                className="suggestCard"
                key={x.id}
                href={link("/store/" + slug + "/products/" + x.id)}
              >
                <span className="suggestPhoto">
                  <ProductPhoto
                    sources={[
                      x.imageUrl,
                      ...(x.gallery || []),
                      brand.logo,
                      logo,
                    ]}
                    alt=""
                  />
                </span>
                <small>{categories(x.category).map(catLabel).join(", ")}</small>
                <strong>{x.name}</strong>
                <NetSize product={x} />
                <span>{fmt(x.salePrice)}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
