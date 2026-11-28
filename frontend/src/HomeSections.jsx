import React from "react";
import { Field } from "./ui";
import { link, logo } from "./navigation";
import { matchesCategory } from "./categories";
import { ProductPhoto } from "./ProductPage";

export const sections = {
  hero: [
    "Hero banner",
    [
      ["heroKicker", "Small heading"],
      ["heroTitle", "Main heading", "Good things."],
      ["heroAccent", "Second heading line", "Better living."],
      [
        "heroText",
        "Banner description",
        "Discover useful, well-designed essentials for your everyday life.",
      ],
      ["heroButton", "Shop button text", "Explore collection"],
    ],
  ],
  collections: [
    "Category showcase",
    [["categoryTitle", "Section heading", "Shop by category"]],
  ],
  featured: [
    "Featured products",
    [["featuredTitle", "Section heading", "Featured products"]],
  ],
  catalog: [
    "Catalog section",
    [
      ["catalogKicker", "Small heading", "THE COLLECTION"],
      ["catalogTitle", "Section heading", "Shop essentials"],
    ],
  ],
  story: [
    "Store story",
    [
      ["storyTitle", "Section heading", "Our story"],
      ["storyText", "Story text"],
    ],
  ],
  footer: ["Footer", [["footerText", "Footer message"]]],
};
export function HomeFields({ tab, home, update, products }) {
  const selected = (home.featuredIds || "").split(",").filter(Boolean);
  return (
    <>
      {["collections", "featured", "story"].includes(tab) && (
        <label className="check">
          <input
            type="checkbox"
            checked={home[tab + "Visible"] !== "off"}
            onChange={(e) =>
              update(tab + "Visible", e.target.checked ? "on" : "off")
            }
          />
          Show this section
        </label>
      )}
      {sections[tab][1].map(([key, label, fallback]) => (
        <Field
          key={key}
          label={label}
          maxLength={key === "storyText" ? 2400 : 300}
          value={home[key] ?? fallback ?? ""}
          placeholder={key === "heroKicker" ? "Store name" : ""}
          onChange={(e) => update(key, e.target.value)}
        />
      ))}
      {tab === "hero" && (
        <Field
          label="Seconds per slide"
          type="number"
          required
          min="2"
          max="30"
          value={home.slideSeconds ?? "5"}
          onChange={(e) => update("slideSeconds", e.target.value)}
        />
      )}
      {tab === "featured" && (
        <fieldset>
          <legend>Products to feature</legend>
          <p className="muted">
            Leave the selection empty to feature the newest four products.
          </p>
          {products.map((p) => (
            <label className="check" key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(String(p.id))}
                onChange={(e) =>
                  update(
                    "featuredIds",
                    (e.target.checked
                      ? [...selected, String(p.id)]
                      : selected.filter((id) => id !== String(p.id))
                    ).join(","),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}
export function Showcase({
  section,
  design,
  home,
  products,
  choices,
  slug,
  categoryUrl,
  pick,
  catLabel,
  t,
  fmt,
}) {
  const ids = (home.featuredIds || "").split(",").filter(Boolean);
  const featured = ids.length
    ? ids.map((id) => products.find((p) => String(p.id) === id)).filter(Boolean)
    : [...products].sort((a, b) => b.id - a.id).slice(0, 4);
  return (
    <>
      {section === "collections" &&
        home.collectionsVisible !== "off" &&
        choices.length > 0 && (
          <section className="wrap homeBand" data-section="collections">
            <h2>
              {t(
                "home:categoryTitle",
                home.categoryTitle ?? "Shop by category",
              )}
            </h2>
            <div className="categoryShelf" data-shelf={design.categoriesLayout}>
              {choices.map((c) => {
                const p = products.find(
                  (p) =>
                    matchesCategory(p.category, c) &&
                    (p.imageUrl || p.gallery?.length),
                );
                return (
                  <a
                    href={categoryUrl(c)}
                    key={c}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
                      e.preventDefault();
                      pick(c);
                      document.getElementById("catalog")?.scrollIntoView();
                    }}
                  >
                    {p && (
                      <ProductPhoto
                        sources={[p.imageUrl, ...(p.gallery || [])]}
                        alt=""
                      />
                    )}
                    <strong>{catLabel(c)}</strong>
                    <span aria-hidden="true">↗</span>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      {section === "featured" &&
        home.featuredVisible !== "off" &&
        featured.length > 0 && (
          <section className="featuredBand" data-section="featured">
            <div className="wrap homeBand">
              <h2>
                {t(
                  "home:featuredTitle",
                  home.featuredTitle ?? "Featured products",
                )}
              </h2>
              <div className="featuredShelf" data-shelf={design.featuredLayout}>
                {featured.map((p) => (
                  <a
                    key={p.id}
                    href={link("/store/" + slug + "/products/" + p.id)}
                    aria-label={p.name + " · " + fmt(p.salePrice)}
                  >
                    <ProductPhoto
                      sources={[p.imageUrl, ...(p.gallery || []), logo]}
                      alt=""
                    />
                    <div>
                      <strong>{p.name}</strong>
                      <small>{fmt(p.salePrice)}</small>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </section>
        )}
    </>
  );
}
