import { watchPublishedCatalog } from "./publishedUpdates";
import logo from "../public/natur-wala.png";
import { pagesLocation, validSlug } from "../src/pagesLocation";
import { catalogRequest, remoteCatalog } from "./remoteCatalog";
const catalog = JSON.parse(document.getElementById("catalog-data").textContent);
const connection = JSON.parse(
  document.getElementById("connection-data").textContent,
);
const preview =
  location.href === "about:srcdoc" &&
  typeof connection.preview === "string" &&
  /^(header|hero|collections|featured|catalog|story|footer|order|block-[a-z0-9-]{1,80})$/.test(
    connection.preview,
  ) &&
  connection.preview;
const target = !preview && !connection.apiOrigin && pagesLocation();
const url = new URL(location.href);
const hashShop = () =>
  location.hash.match(/^#\/store\/([a-z0-9-]+)(?:\/|$)/)?.[1];
const selected = url.searchParams.get("store") ?? hashShop();
const slug =
  target && selected !== undefined
    ? selected
    : connection.slug || catalog.brand.slug;
if (target && selected !== undefined && validSlug(selected)) {
  url.searchParams.set("store", selected);
  // A copied link with conflicting store IDs must never open the other store's product.
  if (hashShop() && hashShop() !== selected) url.hash = "";
  history.replaceState(null, "", url);
}
async function connected(path, method = "GET", body) {
  const origin = new URL(connection.apiOrigin);
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw Error("Use an HTTPS API origin.");
  if (
    ![
      "/stores/" + slug,
      "/stores/" + slug + "/orders",
      "/stores/" + slug + "/revision",
      "/stores/" + slug + "/newsletter",
    ].includes(path) &&
    !(
      path.startsWith("/stores/" + slug + "/products/") &&
      /^\d+\/rating$/.test(
        path.slice(("/stores/" + slug + "/products/").length),
      )
    )
  )
    throw Error("Store unavailable.");
  const res = await fetch(origin.origin + "/api" + path, {
    method,
    credentials: "omit",
    cache: "no-store",
    headers: body
      ? { "Content-Type": "application/json", "X-NW-Request": "portal" }
      : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok)
    throw Object.assign(Error(data?.message || "Store request failed."), {
      status: res.status,
    });
  return data;
}
window.NW_LOCAL = {
  preview,
  request: preview
    ? async (path, method = "GET") => {
        if (method !== "GET") throw Error("Layout preview is read-only.");
        return path.endsWith("/revision") ? catalog.revision : catalog;
      }
    : connection.apiOrigin
      ? connected
      : catalogRequest(catalog),
  logo,
  slug,
  scope:
    "NaturWala.Customer:" +
    location.pathname.replace(/index\.html$/, "") +
    ":" +
    (connection.apiOrigin || "snapshot") +
    ":" +
    (target ? catalog.brand.slug : slug),
  multiStore: Boolean(target),
  published: true,
  simulated: !connection.apiOrigin,
};
if (preview) {
  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("a,button")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true,
  );
  document.addEventListener("submit", (e) => e.preventDefault());
}
if (target) {
  document.getElementById("root").textContent = "Opening store…";
  const remote = remoteCatalog(target, catalog, selected, (next) => {
    if (window.NW_LOCAL.slug === next) return;
    window.NW_LOCAL.slug = next;
    window.dispatchEvent(new Event("nw-store-changed"));
  });
  window.NW_LOCAL.request = remote.request;
  remote.ready.finally(() => require("./store-root.jsx"));
} else {
  require("./store-root.jsx");
  if (!preview && !connection.apiOrigin)
    watchPublishedCatalog(catalog.revision);
}
