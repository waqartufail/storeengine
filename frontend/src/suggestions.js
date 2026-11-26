// History contains only recent catalog IDs from this store and browser tab.
import { categories } from "./categories.js";
export function rememberProduct(key, id) {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) || "[]");
    const recent = Array.isArray(parsed)
      ? parsed.filter(Number.isSafeInteger)
      : [];
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 16);
    sessionStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return [id];
  }
}
function terms(name) {
  return new Set(
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(
        (x) => x.length > 2 && !["and", "the", "for", "with"].includes(x),
      ),
  );
}
export function suggest(products, current, recent, bag) {
  if (!current) return [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const weights = new Map();
  function interest(id, weight) {
    const p = byId.get(id);
    if (!p || p.id === current.id) return;
    for (const category of categories(p.category.toLowerCase()))
      weights.set(category, (weights.get(category) || 0) + weight);
  }
  recent.forEach((id, i) => interest(id, Math.max(1, 8 - i)));
  Object.keys(bag).forEach((id) => interest(Number(id), 8));
  const words = terms(current.name);
  function score(p) {
    const cats = categories(p.category.toLowerCase());
    const currentCats = categories(current.category.toLowerCase());
    const overlap = [...terms(p.name)].filter((x) => words.has(x)).length;
    return (
      (cats.some((c) => currentCats.includes(c)) ? 16 : 0) +
      overlap * 5 +
      Math.min(24, Math.max(0, ...cats.map((c) => weights.get(c) || 0)))
    );
  }
  return products
    .filter((p) => p.id !== current.id && p.stock > 0)
    .map((p) => ({ p, score: score(p) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.p.name.localeCompare(b.p.name) ||
        a.p.id - b.p.id,
    )
    .slice(0, 4)
    .map((x) => x.p);
}
