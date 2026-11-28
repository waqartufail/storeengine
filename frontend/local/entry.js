import { request } from "./api";
import { accounts } from "./storage";
import { pagesLocation, publishKey } from "../src/pagesLocation";
import { snapshot } from "../src/exportStorefront";
import { storeDraft } from "./storeDraft";
import logo from "../public/natur-wala.png";

const target = __NW_ROLE__ === "admin" && pagesLocation();
let slug;
async function adminRequest(path, method = "GET", body) {
  const result = await request(path, method, body);
  if (path === "/admin/settings" && method === "GET") {
    slug = result.brand.slug;
    localStorage.setItem(publishKey(target, slug) + ".merchant", "1");
  }
  const saved =
    method !== "GET" &&
    /^\/admin\/(brand|settings|newsletter-rule|products|import-public)(?:[/?]|$)/.test(
      path,
    );
  if (slug && (saved || (path === "/admin/settings" && method === "GET"))) {
    const view = await request("/stores/" + slug);
    const catalog = snapshot(
      view,
      "draft-" + view.brand.slug + "-" + view.revision,
    );
    await storeDraft(target, view.brand.slug)(true, (s) => {
      s.catalog = catalog;
    });
  }
  return result;
}
window.NW_LOCAL = {
  request: target ? adminRequest : request,
  accounts,
  logo,
  template: __NW_TEMPLATE__,
};
require("./private-root.jsx");
