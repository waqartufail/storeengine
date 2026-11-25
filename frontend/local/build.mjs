import { build } from "esbuild";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { seed } from "./storage.js";
import { snapshot, slot, fillTemplate } from "../src/exportStorefront.js";
const cwd = fileURLToPath(new URL("../", import.meta.url));
async function page(entry, role, extra = "", template = "") {
  const output = await build({
    absWorkingDir: cwd,
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    outfile: "page.js",
    write: false,
    minify: true,
    loader: { ".png": "dataurl" },
    define: {
      "process.env.NODE_ENV": '"production"',
      __NW_ROLE__: JSON.stringify(role),
      __NW_TEMPLATE__: JSON.stringify(template),
    },
  });
  const js = output.outputFiles
    .find((f) => f.path.endsWith(".js"))
    .text.replace(/<\/script/gi, "<\\/script");
  const css = output.outputFiles.find((f) => f.path.endsWith(".css")).text;
  return (
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Natur-Wala &amp; Co.</title><style>' +
    css +
    '</style></head><body><div id="root"></div><noscript>Enable JavaScript to open the store.</noscript>' +
    extra +
    "<script>" +
    js +
    "</script></body></html>"
  );
}
const root = new URL("../../", import.meta.url);
const blank = await page(
  "local/pages-entry.js",
  "pages",
  '<script type="application/json" id="connection-data">{"apiOrigin":"","slug":""}</script>' +
    slot +
    "{}</script>",
);
const s = seed().stores[0];
const demo = fillTemplate(
  blank,
  snapshot(
    {
      brand: s.brand,
      payments: s.config.payments,
      shipping: s.config.shipping,
      products: s.products,
    },
    "sample-honey-v2",
  ),
);
await mkdir(new URL("github-pages/", root), { recursive: true });
await writeFile(new URL("github-pages/index.html", root), demo);
await writeFile(new URL("frontend/public/store-template.html", root), demo);
for (const role of ["store", "admin", "owner"]) {
  const html = await page(
    role === "store" ? "local/store-entry.js" : "local/entry.js",
    role,
    "",
    role === "admin" ? blank : "",
  );
  await writeFile(new URL(role + ".html", root), html);
}
