export function snapshot(view, revision) {
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
  return {
    revision,
    brand: pick(view.brand, [
      "slug",
      "name",
      "browserTitle",
      "logo",
      "banner",
      "promoVideo",
      "bannerSlides",
      "languages",
      "socialLinks",
      "theme",
    ]),
    shipping: pick(view.shipping, [
      "baseCharge",
      "includedWeight",
      "extraPerKg",
    ]),
    payments: view.payments
      .filter((p) => p.enabled)
      .map((p) => pick(p, ["name", "kind", "enabled", "url", "qr", "details"])),
    products: view.products.map((p) =>
      pick(p, [
        "id",
        "name",
        "category",
        "description",
        "stock",
        "price",
        "salePrice",
        "netQuantity",
        "netUnit",
        "weightKg",
        "shippingCharge",
        "imageUrl",
        "details",
        "gallery",
        "promoKind",
        "promoValue",
        "promoLabel",
        "version",
      ]),
    ),
  };
}
export const slot = '<script type="application/json" id="catalog-data">';
export function fillTemplate(template, data) {
  const start = template.indexOf(slot);
  if (start < 0) throw Error("Store export template is unavailable.");
  const end = template.indexOf("</script>", start + slot.length);
  return (
    template.slice(0, start + slot.length) +
    JSON.stringify(data).replace(/</g, "\\u003c") +
    template.slice(end)
  );
}
export async function exportStorefront(view, connection = null) {
  let template = window.NW_LOCAL?.template;
  if (!template) {
    const response = await fetch("/store-template.html");
    if (!response.ok) throw Error("Storefront template could not be loaded.");
    template = await response.text();
  }
  const output = connection
    ? fillTemplate(template, {
        revision: "live",
        brand: { slug: connection.slug },
        products: [],
        payments: [],
        shipping: {},
      }).replace('{"apiOrigin":"","slug":""}', () =>
        JSON.stringify(connection).replace(/</g, "\\u003c"),
      )
    : fillTemplate(
        template,
        snapshot(view, globalThis.crypto.randomUUID?.() || String(Date.now())),
      );
  const url = URL.createObjectURL(new Blob([output], { type: "text/html" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "index.html";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
