export function categories(value = "") {
  const seen = new Map();
  for (const raw of value.split(",")) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (name && !seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}
export function storeCategories(products) {
  return categories(products.map((p) => p.category).join(",")).sort((a, b) =>
    a.localeCompare(b),
  );
}
export function matchesCategory(value, choice) {
  return (
    !choice ||
    categories(value).some(
      (name) => name.toLowerCase() === choice.toLowerCase(),
    )
  );
}
export function sortProducts(products, sort) {
  const asc = sort === "old" || sort === "price-low";
  const price = sort.startsWith("price");
  return [...products].sort(
    (a, b) =>
      (asc ? 1 : -1) * (price ? a.salePrice - b.salePrice : a.id - b.id) ||
      a.id - b.id,
  );
}
