import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const base = process.env.TEST_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
let server;
try {
  const desktop = await browser.newContext(),
    admin = await desktop.newPage();
  const phone = await browser.newContext({
      viewport: { width: 360, height: 780 },
      isMobile: true,
      hasTouch: true,
    }),
    mobile = await phone.newPage();
  const errors = [];
  for (const p of [admin, mobile])
    p.on("pageerror", (e) => errors.push(e.message));
  async function call(path, method = "GET", data) {
    const res = await desktop.request.fetch(base + "/api" + path, {
      method,
      data,
      headers: { "X-NW-Request": "portal" },
    });
    assert(
      res.ok(),
      method +
        " " +
        path +
        " " +
        res.status() +
        " " +
        (await res.text()).slice(0, 140),
    );
    return (await res.text()) ? res.json() : null;
  }
  const email = "mobile-" + Date.now() + "@example.test",
    password = "Demo12345LongPass";
  await call("/auth/signup", "POST", {
    name: "Mobile check",
    adminName: "QA",
    email,
    password,
  });
  await call("/auth/owner/login", "POST", {
    email: process.env.QA_OWNER_EMAIL,
    password: process.env.QA_OWNER_PASSWORD,
  });
  const shop = (await call("/owner/stores")).find((x) => x.email === email);
  await call("/owner/stores/" + shop.id, "PUT", {
    action: "Activate",
    plan: "Trial",
  });
  await call("/auth/admin/login", "POST", { email, password });
  await admin.goto(base + "/admin");
  const images = await admin.evaluate(() =>
    [
      [150, 1150],
      [1200, 210],
    ].map(([w, h], i) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = i ? "green" : "blue";
      ctx.fillRect(0, 0, w, h);
      return c.toDataURL();
    }),
  );
  const p0 = {
    name: "Portrait",
    category: " Gifts, Tea, gifts , ",
    price: 200,
    weightKg: 0.5,
    stock: 9,
    description: "First",
    imageUrl: images[0],
    gallery: [images[1]],
    shippingCharge: 0,
    promoKind: "None",
    promoLabel: "",
    promoValue: 0,
    version: 0,
  };
  const p1 = await call("/admin/products", "POST", p0);
  assert.equal(p1.category, "Gifts, Tea");
  const p2 = await call("/admin/products", "POST", {
    ...p0,
    name: "Second",
    category: "Honey",
    price: 100,
    promoKind: "Percent",
    promoValue: 20,
    promoLabel: "Weekend",
  });
  await call("/admin/products", "POST", {
    ...p0,
    name: "Third",
    category: "Gifts",
    price: 120,
  });
  await admin.getByRole("button", { name: "Store", exact: true }).click();
  await admin.getByLabel("Upload banner slides").setInputFiles(
    images.map((s, i) => ({
      name: i + ".png",
      mimeType: "image/png",
      buffer: Buffer.from(s.split(",")[1], "base64"),
    })),
  );
  await admin.getByAltText("Gallery photo 2", { exact: true }).waitFor();
  await admin.getByRole("button", { name: "Add social link" }).click();
  await admin.getByLabel("Platform name 1").fill("Instagram");
  await admin
    .getByLabel("Profile URL 1")
    .fill("https://www.instagram.com/example.shop/");
  await admin.getByRole("button", { name: "Save branding" }).click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await admin.getByRole("button", { name: "Languages", exact: true }).click();
  await admin
    .getByRole("button", { name: "Enable all listed languages" })
    .click();
  assert(
    (await admin.getByLabel("Edit language").locator("option").count()) >= 228,
  );
  await admin.getByLabel("Language tag").fill("sw");
  await admin
    .getByRole("button", { name: "Enable language", exact: true })
    .click();
  await admin.getByLabel("Translation", { exact: true }).fill("Duka");
  await admin
    .getByRole("button", { name: "Save storefront languages" })
    .click();
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  // Use the actual merchant-generated Pages file in an isolated mobile browser.
  await admin.getByRole("button", { name: "Publish & sync" }).click();
  const download = admin.waitForEvent("download");
  await admin
    .getByRole("button", { name: "Download connected GitHub storefront" })
    .click();
  const dest = join(await mkdtemp(join(tmpdir(), "nw-mobile-")), "index.html");
  await (await download).saveAs(dest);
  const html = await readFile(dest);
  server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(5197, "127.0.0.1", resolve));
  await mobile.goto("http://127.0.0.1:5197/demo/index.html");
  const cardNames = () => mobile.locator(".product h3").allInnerTexts();
  await mobile.getByRole("heading", { name: "Third", exact: true }).waitFor();
  assert.deepEqual(await cardNames(), ["Third", "Second", "Portrait"]);
  await mobile.getByLabel("Sort by").selectOption("old");
  assert.deepEqual(await cardNames(), ["Portrait", "Second", "Third"]);
  await mobile.getByLabel("Sort by").selectOption("price-low");
  assert.deepEqual(await cardNames(), ["Second", "Third", "Portrait"]);
  await mobile.getByLabel("Sort by").selectOption("price-high");
  assert.deepEqual(await cardNames(), ["Portrait", "Third", "Second"]);
  const social = mobile
    .locator("footer")
    .getByRole("link", { name: "Instagram" });
  assert.equal(
    await social.getAttribute("title"),
    await social.getAttribute("href"),
  );
  assert.equal(await social.locator("svg").count(), 1);
  assert.equal(await social.innerText(), "");
  const slides = mobile.locator(".bannerStage img");
  const initial = await slides.getAttribute("src");
  await mobile.waitForFunction(
    (src) =>
      document.querySelector(".bannerStage img")?.getAttribute("src") !== src,
    initial,
    { timeout: 9000 },
  );
  const before = await slides.getAttribute("src");
  await mobile.getByRole("button", { name: "Next banner" }).click();
  assert.notEqual(await slides.getAttribute("src"), before);
  await mobile.getByRole("link", { name: "View Portrait details" }).click();
  for (const w of [320, 390, 768, 1280]) {
    await mobile.setViewportSize({ width: w, height: 800 });
    for (const i of [1, 2]) {
      await mobile.getByRole("button", { name: "View photo " + i }).click();
      const fit = await mobile
        .locator(".detailPhoto img")
        .evaluate(async (el) => {
          await el.decode();
          const r = el.getBoundingClientRect(),
            f = el.parentElement.getBoundingClientRect(),
            css = getComputedStyle(el);
          return {
            ok:
              Math.abs(r.x + r.width / 2 - f.x - f.width / 2) < 2 &&
              Math.abs(r.y + r.height / 2 - f.y - f.height / 2) < 2 &&
              r.width <= f.width + 1 &&
              r.height <= f.height + 1,
            fit: css.objectFit,
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
          };
        });
      assert.deepEqual(fit, { ok: true, fit: "contain", overflow: false });
    }
  }
  await mobile.setViewportSize({ width: 360, height: 760 });
  await mobile
    .getByRole("navigation", { name: "Categories" })
    .getByRole("link", { name: "Gifts" })
    .click();
  await mobile.locator(".product").first().waitFor();
  assert.deepEqual(await cardNames(), ["Third", "Portrait"]);
  await mobile.reload();
  await mobile.locator(".product").first().waitFor();
  assert.deepEqual(await cardNames(), ["Third", "Portrait"]);
  await mobile.getByRole("button", { name: "All", exact: true }).click();
  await mobile.getByLabel("Language").selectOption("sw");
  await mobile.getByRole("link", { name: "Duka", exact: true }).waitFor();
  await mobile.locator(".storeLang select").selectOption("ur");
  await mobile.getByRole("heading", { name: "ضروری اشیا" }).waitFor();
  assert.equal(await mobile.locator("html").getAttribute("dir"), "rtl");
  await mobile.reload();
  await mobile.getByRole("heading", { name: "ضروری اشیا" }).waitFor();
  await mobile.locator(".storeLang select").selectOption("en");
  await admin.getByRole("button", { name: "Product Addition" }).click();
  await admin.locator(".record").filter({ hasText: "Second" }).click();
  await admin.getByLabel("Product name", { exact: true }).fill("Mobile update");
  await admin
    .getByRole("button", { name: "Save product", exact: true })
    .click();
  await admin.getByText("Product saved.", { exact: true }).waitFor();
  await mobile
    .getByRole("heading", { name: "Mobile update", exact: true })
    .waitFor({ timeout: 22000 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop Admin change reached the already-open isolated mobile Pages storefront; category deep links, all sort orders, actual social icon and tooltip, uploaded banner slider, custom language, Urdu RTL persistence, and centered tall/wide PDP images at 320, 390, 768 and 1280 px",
  );
} finally {
  await browser.close();
  if (server) await new Promise((r) => server.close(r));
}
