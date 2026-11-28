import { freshId } from "../src/freshId";
import {
  rawUrl,
  validManifest,
  validSlug,
  storeManifest,
  publishKey,
} from "../src/pagesLocation";
import { storeDraft } from "./storeDraft";
import { createWorkspace } from "./database";
import { publicRequest } from "./commerce";

function publicStore(catalog) {
  return {
    slug: catalog.brand.slug,
    name: catalog.brand.name,
    status: "Active",
    version: catalog.revision,
    brand: catalog.brand,
    config: {
      newsletter: catalog.newsletter,
      shipping: catalog.shipping,
      payments: catalog.payments,
      defaultShipper: "Test shipment",
    },
    products: catalog.products,
    orders: [],
  };
}
// Keep a single shopper ledger per storefront and store, including after a new HTML export.
export function catalogRequest(catalog) {
  const site = new URL("index.html", location.href).href;
  const slug = catalog.brand.slug;
  const db = createWorkspace(
    "NaturWala.Published:" + site + ":" + slug,
    () => ({ nextOrder: 1, stores: [] }),
  );
  let ready;
  const request = publicRequest(db);
  async function prepare() {
    let legacy;
    if (!(await db(false, (s) => s.stores.length))) {
      const oldName =
        "NaturWala.Pages:" +
        new URL(".", location.href).pathname +
        ":" +
        catalog.revision;
      const prior = await createWorkspace(oldName, null)(false, (s) => s).catch(
        () => null,
      );
      if (prior?.stores[0]?.slug === slug) legacy = prior;
    }
    await db(true, (s) => {
      if (!s.stores.length) {
        s.stores = legacy?.stores || [publicStore(catalog)];
        s.nextOrder = legacy?.nextOrder || 1;
      }
      const store = s.stores[0];
      if (store.version === catalog.revision) return;
      const sold = new Map();
      for (const order of store.orders)
        for (const item of order.items)
          sold.set(
            item.productId,
            (sold.get(item.productId) || 0) + item.quantity,
          );
      s.stores[0] = {
        ...store,
        ...publicStore(catalog),
        orders: store.orders,
        products: catalog.products.map((p) => ({
          ...p,
          stock: Math.max(0, p.stock - (sold.get(p.id) || 0)),
        })),
      };
    });
  }
  return async (...args) => {
    ready ??= prepare().catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    return request(...args);
  };
}
export function remoteCatalog(target, initial, selected, onChange) {
  const state = createWorkspace(
    "NaturWala.GitHub:" +
      target.publicUrl +
      (selected === undefined ? "" : "?store=" + selected),
    () => ({
      commit: "",
      catalog: null,
    }),
  );
  let catalog = selected === undefined ? initial : null,
    commit = "",
    request = catalogRequest(initial),
    problem = "",
    pending,
    checked = 0;
  async function apply(value, sha) {
    catalog = value;
    commit = sha;
    request = catalogRequest(value);
    onChange(value.brand.slug);
  }
  async function readManifest(file) {
    const url = new URL(rawUrl(target, "HEAD", file));
    url.searchParams.set("t", Math.floor(Date.now() / 4000));
    const r = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (r.status === 404) return null;
    if (!r.ok) throw Error("Published catalog unavailable.");
    const m = await r.json();
    if (!validManifest(m)) throw Error("Invalid publication.");
    return m;
  }
  const draft = validSlug(selected) && storeDraft(target, selected);
  let draftView;
  let draftRevision, draftApi;
  function draftRequest(view) {
    if (draftRevision !== view.revision) {
      draftRevision = view.revision;
      draftApi = catalogRequest(view);
    }
    return draftApi;
  }
  async function check() {
    if (selected !== undefined && !validSlug(selected)) return;
    if (draft) {
      const pending = localStorage.getItem(
        publishKey(target, selected) + ".dirty",
      );
      // An unsynced merchant can preview saved changes on the editing browser.
      if (pending || !commit) {
        const value = await draft(false, (s) => s.catalog);
        if (value?.brand.slug === selected) draftView = value;
        if (pending && draftView) return;
      }
      if (!pending && commit) draftView = null;
    }
    let m = selected && (await readManifest(storeManifest(selected)));
    if (!m) m = await readManifest("current.json");
    if (!m || (selected !== undefined && m.slug !== selected)) {
      if (selected !== undefined) {
        // Keep standalone exports functional when the embedded store itself was requested.
        catalog = !m && selected === initial.brand.slug ? initial : null;
        if (catalog) request = catalogRequest(initial);
        if (commit)
          await state(true, (s) => {
            s.catalog = null;
            s.commit = "";
          });
        commit = "";
      }
      return;
    }
    draftView = null;
    if (m.commit === commit) return;
    const response = await fetch(rawUrl(target, m.commit, m.slug + ".json"), {
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw Error("Catalog download failed.");
    const fresh = await response.json();
    if (
      fresh.brand?.slug !== m.slug ||
      !fresh.revision ||
      !Array.isArray(fresh.products) ||
      !Array.isArray(fresh.payments) ||
      !fresh.shipping
    )
      throw Error("Invalid published catalog.");
    await apply(fresh, m.commit);
    await state(true, (s) =>
      Object.assign(s, { commit: m.commit, catalog: fresh }),
    );
  }
  async function refresh() {
    if (pending) return pending;
    if (Date.now() - checked < 3500) return;
    checked = Date.now();
    pending = check()
      .then(() => {
        problem = "";
      })
      .catch(() => {
        problem =
          "Cannot reach the published catalog. Check your connection and try again.";
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }
  const ready = state(false, (s) => s)
    .then((s) => {
      if (
        s.catalog &&
        (selected === undefined || s.catalog.brand?.slug === selected)
      )
        return apply(s.catalog, s.commit);
    })
    .catch(() => {})
    .then(refresh);
  // Admin and storefront under the same Pages directory can share the merchant's
  // existing workspace. Never create a merchant account from the public bundle.
  const merchantRequest = publicRequest(
    createWorkspace(
      "NaturWala.Local.v1:" + new URL("RUN-LOCAL.html", location.href).pathname,
      null,
    ),
  );
  return {
    ready,
    request: async (path, method = "GET", body) => {
      await ready;
      if (method === "GET") await refresh();
      const slug = path.split("/")[2];
      if (
        validSlug(slug) &&
        (selected === slug || (!selected && catalog?.brand.slug === slug)) &&
        localStorage.getItem(publishKey(target, slug) + ".merchant") === "1"
      ) {
        const result = await merchantRequest(path, method, body);
        if (method === "POST" && path.endsWith("/orders")) {
          localStorage.setItem(publishKey(target, slug) + ".dirty", "1");
          localStorage.setItem(
            publishKey(target, slug) + ".checkout",
            freshId(),
          );
        }
        return result;
      }
      if (draftView?.brand.slug === slug)
        return draftRequest(draftView)(path, method, body);
      if (problem && !commit) throw Error(problem);
      if (!catalog || slug !== catalog.brand.slug)
        throw Error(
          "This store has no published catalog at this link. Open its Admin and sync the store.",
        );
      return request(path, method, body);
    },
  };
}
