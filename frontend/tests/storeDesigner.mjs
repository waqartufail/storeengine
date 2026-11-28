import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
try {
  const ctx = await browser.newContext(),
    admin = await ctx.newPage(),
    shop = await ctx.newPage();
  const errors = [];
  for (const p of [admin, shop]) {
    p.setDefaultTimeout(8000);
    p.on("pageerror", (e) => errors.push(e.message));
  }
  const button = (p, name) => p.getByRole("button", { name, exact: true });
  if (process.env.TEST_URL) {
    const base = process.env.TEST_URL,
      email = "layout-" + Date.now() + "@example.test",
      password = "Designer-test-1234!";
    async function api(path, method = "GET", data) {
      const r = await ctx.request.fetch(base + "/api" + path, {
        method,
        data,
        headers: { "X-NW-Request": "portal" },
      });
      const body = await r.text();
      assert(r.ok(), path + " " + r.status() + " " + body);
      return body ? JSON.parse(body) : null;
    }
    await api("/auth/signup", "POST", {
      name: "Designer QA",
      adminName: "Merchant",
      email,
      password,
    });
    await api("/auth/owner/login", "POST", {
      email: process.env.QA_OWNER_EMAIL,
      password: process.env.QA_OWNER_PASSWORD,
    });
    const merchant = (await api("/owner/stores")).find(
      (x) => x.email === email,
    );
    await api("/owner/stores/" + merchant.id, "PUT", {
      action: "Activate",
      plan: "Trial",
    });
    await api("/auth/admin/login", "POST", { email, password });
    for (const category of ["Tea", "Pantry"])
      await api("/admin/products", "POST", {
        name: category,
        category,
        description: "QA item",
        price: 100,
        stock: 3,
        weightKg: 0.2,
        imageUrl: "",
        shippingCharge: 0,
        promoKind: "None",
        promoLabel: "",
        promoValue: 0,
        version: 0,
      });
    await admin.goto(base + "/admin");
  } else {
    await admin.goto(new URL("../../admin.html", import.meta.url).href);
    await button(admin, "Sign in").click();
  }
  const href = await admin
    .getByRole("link", { name: /Open store/ })
    .getAttribute("href");
  await shop.goto(new URL(href, admin.url()).href);
  await shop.locator(".product").first().waitFor();
  await button(admin, "Footer").click();
  await admin.getByLabel("Footer message").fill("Made in Lahore");
  await button(admin, "Add social link").click();
  await admin.getByLabel("Platform name 1").fill("Instagram");
  await admin.getByLabel("Profile URL 1").fill("https://instagram.com/example");
  await button(admin, "Save section").click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await button(admin, "Store designer").click();
  const area = admin.getByLabel("Design area"),
    pick = (label, value) =>
      admin.getByLabel(label, { exact: true }).selectOption(value);
  const preview = admin.frameLocator("iframe[title='Store layout preview']");
  await preview.locator(".product").first().waitFor();
  await pick("Logo position", "center");
  await pick("Logo shape", "circle");
  await pick("Logo size", "large");
  await pick("Store name beside logo", "below");
  await area.selectOption("hero");
  await pick("Banner layout", "right");
  await pick("Banner text alignment", "center");
  await area.selectOption("collections");
  await pick("Category layout", "horizontal");
  await area.selectOption("featured");
  await pick("Featured product layout", "vertical");
  await area.selectOption("footer");
  await pick("Footer name alignment", "right");
  await pick("Footer message alignment", "center");
  await pick("Social icon alignment", "left");
  await area.selectOption("catalog");
  await pick("Product layout", "vertical");
  await pick("Filter position", "right");
  await pick("Category filter style", "select");
  await preview
    .locator('#catalog[data-filters="right"] select[aria-label="Categories"]')
    .waitFor();
  assert.equal(
    await shop.locator("#catalog").getAttribute("data-filters"),
    "top",
  );
  await button(admin, "Mobile").click();
  assert.equal(
    await preview
      .locator("body")
      .evaluate((e) => e.ownerDocument.defaultView.innerWidth),
    375,
  );
  await area.selectOption("order");
  await button(admin, "Move Category showcase up").click();
  await button(admin, "Save design").click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await shop.reload();
  await shop
    .getByRole("combobox", { name: "Categories", exact: true })
    .waitFor();
  assert.deepEqual(
    await shop
      .locator("body [data-section]")
      .evaluateAll((es) => es.map((e) => e.dataset.section)),
    ["header", "collections", "hero", "featured", "catalog", "footer"],
  );
  const css = (sel, prop) =>
    shop.locator(sel).evaluate((e, p) => getComputedStyle(e)[p], prop);
  assert.equal(await css(".logo", "borderRadius"), "50%");
  assert.equal(await css(".brand", "justifySelf"), "center");
  assert.equal(await css(".footName", "textAlign"), "right");
  assert.equal(await css(".foot p", "textAlign"), "center");
  assert.equal(
    await css('nav[aria-label="Social media"]', "justifyContent"),
    "left",
  );
  assert.equal(await css(".categoryShelf", "gridAutoFlow"), "column");
  await shop
    .getByRole("combobox", { name: "Categories", exact: true })
    .selectOption("Tea");
  assert.equal(await shop.locator(".product").count(), 1);
  const grid = await shop.locator("#catalog>.grid").boundingBox(),
    tools = await shop.locator(".catalogTools").boundingBox();
  assert(tools.x >= grid.x + grid.width - 1);
  for (const w of [320, 390, 768, 1280]) {
    await shop.setViewportSize({ width: w, height: 760 });
    assert(
      await shop.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "overflow at " + w,
    );
  }
  await admin.reload();
  await area.waitFor();
  await area.selectOption("footer");
  assert.equal(
    await admin.getByLabel("Footer name alignment").inputValue(),
    "right",
  );
  await button(admin, "Preview default layout").click();
  await preview.locator('#catalog[data-filters="top"]').waitFor();
  assert.equal(
    await shop.locator("#catalog").getAttribute("data-filters"),
    "right",
  );
  await button(admin, "Add custom section").click();
  await admin.getByLabel("Custom section heading").fill("Tea tasting");
  await admin
    .getByLabel("Custom section text", { exact: true })
    .fill("Discover this season’s teas.");
  await admin.getByLabel("Custom section layout").selectOption("horizontal");
  await admin.getByLabel("Custom section text alignment").selectOption("right");
  await preview.getByRole("heading", { name: "Tea tasting" }).waitFor();
  const custom = await area.inputValue();
  await area.selectOption("order");
  await button(admin, "Move Tea tasting up").click();
  await button(admin, "Save design").click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await shop.reload();
  await shop.getByText("Discover this season’s teas.").waitFor();
  assert.equal(await css(".merchantBlock", "textAlign"), "right");
  await area.selectOption(custom);
  await admin.getByLabel("Show on storefront").uncheck();
  await button(admin, "Save design").click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await shop.reload();
  await shop.locator(".product").first().waitFor();
  assert.equal(await shop.locator(".merchantBlock").count(), 0);
  await button(admin, "Remove from draft").click();
  await button(admin, "Save design").click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await admin.reload();
  await area.waitFor();
  assert(
    !(await area.locator("option").allTextContents()).includes("Tea tasting"),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS unsaved live desktop/mobile preview, persisted layout and order, logo styling, vertical/horizontal displays, independently aligned footer, functional sidebar category select and responsive sizing.",
  );
} finally {
  await browser.close();
}
