import assert from "node:assert/strict";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
const template = await readFile(
  new URL("../../github-pages/index.html", import.meta.url),
  "utf8",
);
let staticPage = template;
const api = process.env.TEST_URL;
const server = createServer((req, res) => {
  if (
    req.url.startsWith("/sample-shop/index.html") ||
    req.url.startsWith("/sample-shop/?") ||
    req.url === "/sample-shop/"
  ) {
    res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
    res.end(staticPage);
  } else if (api && req.url.startsWith("/connected/")) {
    res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
    res.end(
      template.replace(
        '{"apiOrigin":"","slug":""}',
        JSON.stringify({ apiOrigin: api, slug: currentSlug }),
      ),
    );
  } else {
    res.writeHead(404);
    res.end();
  }
});
let currentSlug = "";
await new Promise((resolve) => server.listen(5197, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:5197";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
async function buy(page, product) {
  await page
    .getByRole("button", { name: "Add " + product + " to bag" })
    .click();
  await page.getByRole("button", { name: "Bag (1)", exact: true }).click();
  await page.getByRole("button", { name: "Checkout", exact: true }).click();
  await page.getByLabel("Full name").fill("Test customer");
  await page.getByLabel("Phone number").fill("03001234567");
  await page.getByLabel("Delivery city").fill("Lahore");
  await page.getByLabel("Delivery address").fill("Sample address");
  await page.getByRole("button", { name: "Place order", exact: true }).click();
  await page
    .getByRole("heading", { name: "Thank you for your order!" })
    .waitFor();
  const id = await page.locator(".orderNumber strong").innerText();
  await page.reload();
  assert.equal(await page.locator(".orderNumber strong").innerText(), id);
  return id;
}
try {
  const ctx = await browser.newContext(),
    p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(8000);
  for (const term of [
    "NaturOwner123!",
    "owner@naturwala.local",
    "Store approvals",
    "/owner/stores",
    "NaturAdmin123!",
    "/admin/products",
    "Admin dashboard",
  ]) {
    assert(!template.includes(term), term);
  }
  await p.goto(origin + "/sample-shop/#/owner");
  await p
    .getByRole("button", { name: "Add Wildflower Honey to bag" })
    .waitFor();
  assert.equal(
    await p.getByRole("link", { name: /owner|admin|portals/i }).count(),
    0,
  );
  assert.equal(
    (await ctx.request.get(origin + "/sample-shop/owner.html")).status(),
    404,
  );
  assert.equal(
    (await ctx.request.get(origin + "/sample-shop/admin.html")).status(),
    404,
  );
  await p.locator(".product").getByText("400 g", { exact: true }).waitFor();
  await p
    .getByRole("link", { name: "View Cold-Pressed Almond Oil details" })
    .click();
  await p.locator(".detailGrid").getByText("200 ml", { exact: true }).waitFor();
  assert.doesNotMatch(await p.locator("body").innerText(), /\bkg\b/i);
  await p.getByRole("link", { name: /Back to store/ }).click();
  await buy(p, "Wildflower Honey");
  assert.match(await p.locator(".thankYou").innerText(), /965/);
  console.log(
    "PASS Pages project subdirectory, public-only bundle, privileged file omissions, 10% discount, PKR 965 total and persisted order number",
  );
  const admin = await ctx.newPage();
  await admin.goto(new URL("../../admin.html", import.meta.url).href);
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  const download = admin.waitForEvent("download");
  await admin
    .getByRole("button", { name: "Download GitHub storefront" })
    .click();
  const dir = await mkdtemp(join(tmpdir(), "nw-export-")),
    dest = join(dir, "index.html");
  await (await download).saveAs(dest);
  const exported = await readFile(dest, "utf8");
  for (const term of [
    "NaturOwner123!",
    "admin@naturwala.local",
    "passwordHash",
    "/owner/stores",
    "/admin/products",
  ])
    assert(!exported.includes(term), term);
  await p.goto(pathToFileURL(dest).href);
  await p
    .getByRole("button", { name: "Add Wildflower Honey to bag" })
    .waitFor();
  assert.equal(await p.locator(".product").count(), 3);
  console.log(
    "PASS merchant export produces a runnable customer-only index.html",
  );
  // An already-open phone should see a republished snapshot without losing its cart or interrupting checkout.
  const visitor = await browser.newContext({
      viewport: { width: 390, height: 780 },
    }),
    mobile = await visitor.newPage();
  await mobile.goto(origin + "/sample-shop/");
  await mobile
    .getByRole("button", { name: "Add Wildflower Honey to bag" })
    .click();
  await mobile.getByRole("button", { name: "Bag (1)", exact: true }).click();
  await mobile.getByRole("button", { name: "Checkout", exact: true }).click();
  await mobile.getByLabel("Full name").fill("Sample customer");
  staticPage = template
    .replace(
      '"revision":"sample-honey-v3"',
      '"revision":"sample-honey-republished"',
    )
    .replace('"name":"Wildflower Honey"', '"name":"Republished Honey"');
  assert.notEqual(staticPage, template);
  await mobile.evaluate(() => window.dispatchEvent(new Event("focus")));
  assert.equal(
    await mobile.getByLabel("Full name").inputValue(),
    "Sample customer",
  );
  await mobile.getByRole("button", { name: "Close", exact: true }).click();
  await mobile.evaluate(() => window.dispatchEvent(new Event("focus")));
  await mobile
    .getByRole("heading", { name: "Republished Honey", exact: true })
    .waitFor({ timeout: 15000 });
  await mobile.getByRole("button", { name: "Bag (1)", exact: true }).waitFor();
  staticPage = template;
  await visitor.close();
  console.log(
    "PASS republished static catalog reaches the mobile tab and preserves the bag without interrupting checkout",
  );
  if (api) {
    const session = await browser.newContext();
    const a = session.request;
    const hdr = { "X-NW-Request": "portal" };
    async function call(path, method = "GET", body) {
      const r = await a.fetch(api + "/api" + path, {
        method,
        headers: hdr,
        data: body,
      });
      assert(r.ok(), path + " " + r.status() + " " + (await r.text()));
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    }
    const email = "pages-" + Date.now() + "@example.test",
      password = "Test-pages-pass123";
    await call("/auth/signup", "POST", {
      name: "Pages QA",
      adminName: "Merchant",
      email,
      password,
    });
    await call("/auth/owner/login", "POST", {
      email: process.env.QA_OWNER_EMAIL,
      password: process.env.QA_OWNER_PASSWORD,
    });
    const s = (await call("/owner/stores")).find((s) => s.email === email);
    currentSlug = s.slug;
    await call("/owner/stores/" + s.id, "PUT", {
      action: "Activate",
      plan: "Monthly",
    });
    await call("/auth/admin/login", "POST", { email, password });
    await call("/admin/products", "POST", {
      name: "Live tea",
      description: "",
      category: "Tea",
      price: 100,
      stock: 3,
      imageUrl: "",
      weightKg: 1,
      shippingCharge: 0,
      promoLabel: "Tea deal",
      promoKind: "Fixed",
      promoValue: 25,
      version: 0,
    });
    await p.goto(origin + "/connected/");
    const id = await buy(p, "Live tea");
    assert.match(await p.locator(".thankYou").innerText(), /275/);
    const orders = await call("/admin/orders");
    assert.equal("#" + orders[0].id, id);
    assert.equal(orders[0].total, 275);
    const forbidden = await p.evaluate(async (url) => {
      try {
        await fetch(url + "/api/owner/stores");
        return false;
      } catch {
        return true;
      }
    }, api);
    assert(forbidden);
    console.log(
      "PASS cross-origin Pages storefront reads merchant promotion, posts checkout to API/PostgreSQL and returns the same order number as admin; management endpoint is unavailable cross-origin",
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
