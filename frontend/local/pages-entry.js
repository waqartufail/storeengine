import logo from "../public/natur-wala.png";
import { createWorkspace } from "./database";
import { publicRequest } from "./commerce";
const catalog = JSON.parse(document.getElementById("catalog-data").textContent);
const connection = JSON.parse(
  document.getElementById("connection-data").textContent,
);
const slug = connection.slug || catalog.brand.slug;
const scope =
  "NaturWala.Pages:" +
  new URL(".", location.href).pathname +
  ":" +
  catalog.revision;
const transaction = createWorkspace(scope, () => ({
  nextOrder: 1,
  stores: [
    {
      slug: catalog.brand.slug,
      status: "Active",
      name: catalog.brand.name,
      brand: catalog.brand,
      config: {
        shipping: catalog.shipping,
        payments: catalog.payments,
        defaultShipper: "Test shipment",
      },
      products: catalog.products,
      orders: [],
    },
  ],
}));
async function connected(path, method = "GET", body) {
  const origin = new URL(connection.apiOrigin);
  if (
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(origin.hostname)
  )
    throw Error("Use an HTTPS API origin.");
  if (!["/stores/" + slug, "/stores/" + slug + "/orders"].includes(path))
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
  request: connection.apiOrigin ? connected : publicRequest(transaction),
  logo,
  slug,
  scope,
  published: true,
  simulated: !connection.apiOrigin,
};
require("./store-root.jsx");
