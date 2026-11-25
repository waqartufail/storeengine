import assert from "node:assert/strict";
import { suggest } from "../src/suggestions.js";
const row = (id, name, category, stock = 1) => ({ id, name, category, stock });
const items = [
  row(1, "Orange blossom oil", "Oils"),
  row(2, "Orange blossom soap", "Soap"),
  row(3, "Honey", "Pantry"),
  row(4, "Mint tea", "Pantry"),
  row(5, "Coconut oil", "Oils"),
  row(6, "Orange concentrate", "Oils", 0),
];
const ids = (recent, bag) =>
  suggest(items, items[0], recent, bag).map((p) => p.id);
assert.deepEqual(ids([], {}), [5, 2, 3, 4]);
assert.deepEqual(ids([3, 4], { 4: 1 }), [3, 4, 5, 2]);
assert.deepEqual(ids([99], { 100: 1 }), ids([], {}));
assert.deepEqual(suggest([items[0]], items[0], [], {}), []);
console.log(
  "PASS same-store suggestion ranking, recent views and bag interests, empty and out-of-stock exclusions",
);
