import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const local = Boolean(process.env.TEST_LOCAL_FILE);
const base = local
  ? pathToFileURL(process.env.TEST_LOCAL_FILE).href
  : process.env.TEST_URL || "http://localhost:5173";
const route = (path) =>
  local
    ? new URL(path.split("/")[1] + ".html#" + path, base).href
    : base + path;
const unique = Date.now();
const shopName = "UI Natur " + unique,
  email = "ui" + unique + "@example.test",
  pw = "TestPortal-" + unique;
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const shared = local ? await browser.newContext({ offline: true }) : null;
if (shared)
  shared.on("request", (req) => {
    if (/^https?:/.test(req.url()))
      errors.push("Network dependency: " + req.url());
  });
const image = fileURLToPath(
  new URL("../public/natur-wala.png", import.meta.url),
);
async function page(w) {
  const ctx = shared || (await browser.newContext()),
    p = await ctx.newPage();
  await p.setViewportSize({ width: w, height: 850 });
  p.setDefaultTimeout(8000);
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("dialog", (d) => d.accept());
  return p;
}
async function narrow(p) {
  assert(
    await p.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "Horizontal overflow at " + p.url(),
  );
}
async function submit(p, text, path) {
  if (local) {
    await p.getByRole("button", { name: text, exact: true }).click();
    const notice = {
      "Request approval": "Registration received.",
      "Save product": "Product saved.",
      "Save branding": "Settings saved.",
      "Save shipping & couriers": "Settings saved.",
      "Save payment settings": "Settings saved.",
    }[text];
    if (notice)
      await p.getByRole("status").filter({ hasText: notice }).first().waitFor();
    return;
  }
  const response = p.waitForResponse(
    (r) =>
      r.url().includes(path) && ["PUT", "POST"].includes(r.request().method()),
  );
  await p.getByRole("button", { name: text, exact: true }).click();
  const r = await response;
  assert(r.ok(), r.status() + " " + (await r.text()));
}
async function signIn(p, role, email, password) {
  await p.goto(route("/" + role));
  const f = p
    .getByRole("button", { name: "Sign in", exact: true })
    .locator("..");
  await f.getByLabel("Email", { exact: true }).fill(email);
  await f.getByLabel("Password", { exact: true }).fill(password);
  await submit(p, "Sign in", "/login");
}
try {
  const admin = await page(360),
    owner = await page(1280),
    shop = await page(390);
  if (local) {
    await admin.goto(base);
    await admin
      .getByRole("button", { name: "Add Wildflower Honey to bag" })
      .waitFor();
    assert.equal(
      await admin.getByRole("link", { name: /owner|admin|portals/i }).count(),
      0,
    );
    await owner.goto(route("/owner"));
    await owner.getByRole("button", { name: "Sign in", exact: true }).click();
    await owner.getByRole("heading", { name: "Store approvals" }).waitFor();
    await owner.getByRole("button", { name: "Sign out" }).click();
    await shop.goto(route("/store/natur-wala"));
    await shop
      .getByRole("button", { name: "Add Wildflower Honey to bag" })
      .waitFor();
  }
  await admin.goto(route("/admin"));
  await admin.getByLabel("Admin name", { exact: true }).fill("QA Admin");
  await admin.getByLabel("Store name", { exact: true }).fill(shopName);
  await admin.getByLabel("Admin email").fill(email);
  await admin.getByLabel("New password").fill(pw);
  await submit(admin, "Request approval", "/signup");
  await narrow(admin);
  await signIn(
    owner,
    "owner",
    local ? "owner@naturwala.local" : process.env.QA_OWNER_EMAIL,
    local ? "NaturOwner123!" : process.env.QA_OWNER_PASSWORD,
  );
  const row = owner.locator("article").filter({ hasText: shopName });
  await row.getByLabel("Approval plan").selectOption("Monthly");
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await row.getByText("Active", { exact: true }).waitFor();
  await narrow(owner);
  await signIn(admin, "admin", email, pw);
  await admin
    .getByRole("button", { name: "Product Addition", exact: true })
    .click();
  const editor = admin.locator("#product-editor");
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Botanical tea");
  await editor.getByLabel("Price (PKR)").fill("500");
  await editor.getByLabel("Stock quantity").fill("4");
  await editor.getByLabel("Product weight (kg)").fill("2.6");
  await editor
    .getByLabel("Promotion", { exact: true })
    .selectOption("Custom percentage");
  await editor.getByLabel("Promotion label").fill("Harvest special");
  await editor.getByLabel("Discount (%)").fill("15");
  await submit(admin, "Save product", "/admin/products");
  await admin.getByRole("button", { name: /Botanical tea.*Stock/ }).click();
  await editor.getByLabel("Product name", { exact: true }).fill("Organic tea");
  await submit(admin, "Save product", "/admin/products");
  await admin.getByRole("button", { name: "Promotions", exact: true }).click();
  await admin
    .getByLabel("Product to promote")
    .selectOption({ label: "Organic tea" });
  await admin.getByLabel("Promotion", { exact: true }).selectOption("20% off");
  await submit(admin, "Save promotion", "/products");
  await admin
    .getByRole("status")
    .filter({ hasText: "Promotion applied to Organic tea." })
    .waitFor();
  await admin.getByLabel("Promotion", { exact: true }).selectOption("None");
  await submit(admin, "Save promotion", "/products");
  await admin
    .getByRole("status")
    .filter({ hasText: "Promotion removed from Organic tea." })
    .waitFor();
  await admin
    .getByLabel("Promotion", { exact: true })
    .selectOption("Custom percentage");
  await admin.getByLabel("Promotion label").fill("Harvest special");
  await admin.getByLabel("Discount (%)").fill("15");
  await submit(admin, "Save promotion", "/products");
  await admin
    .getByRole("status")
    .filter({ hasText: "Promotion applied to Organic tea." })
    .waitFor();
  await admin
    .getByRole("button", { name: "Product Addition", exact: true })
    .click();
  await admin.getByLabel("Stock status").selectOption("Out of Stock");
  await admin.getByText("No products match these filters.").waitFor();
  await admin.getByLabel("Stock status").selectOption("In Stock");
  await admin.getByPlaceholder("Search product").fill("Organic");
  await admin.getByRole("button", { name: /Organic tea.*Stock/ }).waitFor();
  await narrow(admin);
  await admin
    .getByRole("button", { name: "Themes & Appearance", exact: true })
    .click();
  assert.equal(await admin.locator(".themeChoice").count(), 10);
  await admin.getByRole("button", { name: /Ocean Blue/ }).click();
  await admin
    .locator(".themeChoice.selected")
    .filter({ hasText: "Ocean Blue" })
    .waitFor();
  await admin.getByRole("button", { name: "Store", exact: true }).click();
  await admin.getByLabel("Browser title").fill("Natur Tea Shop");
  await admin.getByLabel("Store logo").setInputFiles(image);
  await admin.getByLabel("Store banner").setInputFiles(image);
  await admin.getByAltText("Store banner preview").waitFor();
  await submit(admin, "Save branding", "/admin/brand");
  await narrow(admin);
  await admin
    .getByRole("button", { name: "Courier Configuration", exact: true })
    .click();
  await admin.getByLabel("Included shipment weight").fill("4");
  await admin.getByLabel("Custom courier name").fill("Local rider");
  await admin.getByRole("button", { name: "Add courier", exact: true }).click();
  await admin.getByLabel("Enable Local rider").check();
  await admin.getByLabel("Default shipper").selectOption("Local rider");
  await submit(admin, "Save shipping & couriers", "/admin/settings");
  await narrow(admin);
  await admin
    .getByRole("button", { name: "Payment Configurations", exact: true })
    .click();
  const jazz = admin
    .locator("fieldset")
    .filter({ has: admin.locator("legend", { hasText: "JazzCash" }) });
  await jazz.getByLabel("Enable JazzCash").check();
  await jazz.getByLabel("Upload QR image").setInputFiles(image);
  await jazz.getByAltText("Upload QR image preview").waitFor();
  await submit(admin, "Save payment settings", "/admin/settings");
  await narrow(admin);
  const url = await admin
    .getByRole("link", { name: "Open store" })
    .getAttribute("href");
  await shop.goto(new URL(url, base).href);
  await shop
    .getByRole("button", { name: "Add Organic tea to bag" })
    .click({ clickCount: 1 });
  await shop.getByRole("button", { name: "Bag (1)", exact: true }).click();
  await shop.getByRole("button", { name: "Increase quantity" }).click();
  await shop.getByRole("button", { name: "Checkout", exact: true }).click();
  await shop.getByLabel("Full name").fill("Test buyer");
  await shop.getByLabel("Phone number").fill("03001234567");
  await shop.getByLabel("Delivery city").fill("Lahore");
  await shop.getByLabel("Delivery address").fill("Test lane");
  await shop.getByLabel("Payment method").selectOption("JazzCash");
  await shop.getByAltText("Payment QR code").waitFor();
  await shop.getByLabel("Payment reference").fill("QA-TRANSFER");
  assert.equal(await shop.title(), "Natur Tea Shop");
  await narrow(shop);
  await submit(shop, "Place order", "/orders");
  await shop
    .getByRole("heading", { name: "Thank you for your order!" })
    .waitFor();
  const placedNumber = (
    await shop.locator(".orderNumber strong").innerText()
  ).replace("#", "");
  assert.match(await shop.locator(".thankYou").innerText(), /1,150/);
  await shop.reload();
  await shop
    .getByRole("heading", { name: "Thank you for your order!" })
    .waitFor();
  assert.equal(
    await shop.locator(".orderNumber strong").innerText(),
    "#" + placedNumber,
  );
  await shop.getByRole("button", { name: "Continue shopping" }).click();
  await shop.getByRole("button", { name: "Bag (0)" }).waitFor();
  await admin
    .getByRole("button", { name: "Orders Status", exact: true })
    .click();
  await admin.getByLabel("Product", { exact: true }).fill("no-such-product");
  await admin.getByText("No orders match these filters.").waitFor();
  await admin.getByRole("button", { name: "Clear filters" }).click();
  const record = admin.getByRole("link", { name: /Order #\d+ · Test buyer/ });
  const number = (await record.innerText()).match(/#(\d+)/)[1];
  assert.equal(number, placedNumber);
  await admin.getByLabel("Order No").fill(number);
  await admin.getByLabel("From date").fill("2000-01-01");
  await admin.getByLabel("To date").fill("2099-12-31");
  await admin.getByLabel("Status", { exact: true }).selectOption("Pending");
  await record.click();
  await admin.getByRole("heading", { name: "Order #" + number }).waitFor();
  if (local) await admin.reload();
  await admin.getByText(/Reference QA-TRANSFER/).waitFor();
  await submit(admin, "Mark payment verified", "/verify-payment");
  await admin.getByLabel("Verified courier tracking number").fill("LOCAL-QA");
  await submit(admin, "Save tracking number", "/tracking");
  await admin.getByText(/Booked · LOCAL-QA/).waitFor();
  await admin.setViewportSize({ width: 320, height: 720 });
  await narrow(admin);
  // Exercise the same authenticated screens across narrow phones, tablets and desktop.
  for (const width of [320, 768, 1280]) {
    for (const p of [owner, shop, admin]) {
      await p.setViewportSize({ width, height: 850 });
      await narrow(p);
    }
  }
  await admin.getByRole("link", { name: "All orders" }).click();
  await admin
    .getByRole("button", { name: "Product Addition", exact: true })
    .click();
  await admin.getByRole("button", { name: "Remove", exact: true }).click();
  await admin.getByText("No products match these filters.").waitFor();
  await row.getByRole("button", { name: "Deactivate", exact: true }).click();
  await row.getByText("Inactive", { exact: true }).waitFor();
  await admin.reload();
  await admin.getByRole("heading", { name: "Admin login" }).waitFor();
  await shop.reload();
  await shop
    .getByRole("heading", { name: "This store is unavailable." })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS Chromium signup → approval → product edit/filter → theme and branding uploads → custom courier, QR and checkout → order detail, reconciliation, removal and deactivation. Widths 320, 360, 390 and 1280 px.",
  );
} finally {
  await browser.close();
}
