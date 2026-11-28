import assert from "node:assert/strict";
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  const base = process.env.TEST_URL,
    ctx = await browser.newContext(),
    admin = await ctx.newPage();
  ctx.setDefaultTimeout(12000);
  const shop = await (base ? await browser.newContext() : ctx).newPage();
  shop.setDefaultTimeout(12000);
  const errors = [];
  for (const page of [shop, admin])
    page.on("pageerror", (e) => errors.push(e.message));
  const button = (p, name) => p.getByRole("button", { name, exact: true });
  async function request(page, path, method = "GET", body) {
    if (base) {
      const res = await page
        .context()
        .request.fetch(base + "/api" + path, {
          method,
          data: body,
          headers: { "X-NW-Request": "portal" },
        });
      if (!res.ok())
        throw Error(path + " HTTP " + res.status() + ": " + (await res.text()));
      const v = await res.text();
      return v ? JSON.parse(v) : null;
    }
    return page.evaluate(
      ([path, method, body]) => window.NW_LOCAL.request(path, method, body),
      [path, method, body],
    );
  }
  if (base) {
    const email = "merchant-" + Date.now() + "@example.test",
      password = "QA-star-store-123";
    await request(admin, "/auth/signup", "POST", {
      email,
      password,
      name: "Offer shop",
      adminName: "Merchant",
    });
    await request(admin, "/auth/owner/login", "POST", {
      email: process.env.QA_OWNER_EMAIL,
      password: process.env.QA_OWNER_PASSWORD,
    });
    const s = (await request(admin, "/owner/stores")).find(
      (x) => x.email === email,
    );
    await request(admin, "/owner/stores/" + s.id, "PUT", {
      action: "Activate",
      plan: "Trial",
    });
    await request(admin, "/auth/admin/login", "POST", { email, password });
    await admin.goto(base + "/admin");
  } else {
    await admin.goto(new URL("../../admin.html", import.meta.url).href);
    await button(admin, "Sign in").click();
  }
  const shopUrl = new URL(
    await admin.getByRole("link", { name: /Open store/ }).getAttribute("href"),
    admin.url(),
  ).href;
  await button(admin, "Product Addition").click();
  const name = "Review phone",
    editor = admin.locator("#product-editor");
  await editor.getByLabel("Product name", { exact: true }).fill(name);
  await editor.getByLabel("Stock quantity").fill("5");
  await editor.getByLabel("Price (PKR)").fill("1000");
  await button(admin, "Save product").click();
  await admin.getByText("Product saved.", { exact: true }).waitFor();
  await button(admin, "Product Details").click();
  await admin.getByLabel("Product to configure").selectOption({ label: name });
  await admin
    .getByLabel("Product disclosures")
    .fill("Refurbished handset.\nCharger sold separately.");
  await button(admin, "Save product details").click();
  await admin.getByText("Product details saved for " + name + ".").waitFor();
  await button(admin, "Promotions").click();
  await admin.getByLabel("Enable newsletter promotion").check();
  assert.equal(
    await admin.getByLabel("Welcome discount (%)").inputValue(),
    "15",
  );
  await admin.getByLabel("Minimum product subtotal (PKR)").fill("1500");
  await button(admin, "Save newsletter rule").click();
  await admin.getByText("Newsletter rule saved.").waitFor();
  await shop.goto(shopUrl);
  const settings = await request(admin, "/admin/settings");
  const path = "/stores/" + settings.brand.slug;
  const product = (await request(shop, path)).products.find(
    (x) => x.name === name,
  );
  await shop.getByRole("link", { name: "View " + name + " details" }).click();
  await shop.getByText("Charger sold separately.", { exact: false }).waitFor();
  await button(shop, "5 stars").click();
  await shop.getByText("5.0 / 5 · 1 rating", { exact: true }).waitFor();
  await button(shop, "3 stars").click();
  await shop.getByText("3.0 / 5 · 1 rating", { exact: true }).waitFor();
  await shop.reload();
  assert.equal(
    await button(shop, "3 stars").getAttribute("aria-pressed"),
    "true",
  );
  const ratingPath = path + "/products/" + product.id + "/rating";
  assert.deepEqual(
    await request(shop, ratingPath, "POST", {
      voter: "2dffeacc-555b-40c6-aaaa-9624f192a291",
      stars: 5,
    }),
    { count: 2, average: 4 },
  );
  await shop.goto(shopUrl);
  const email = "reader@example.test";
  assert(await button(shop, "Get welcome discount").isDisabled());
  await shop.getByLabel(/I agree to receive/).check();
  await shop.getByLabel("Newsletter email").fill(email);
  await button(shop, "Get welcome discount").click();
  await shop.getByText("Your welcome discount is ready.").waitFor();
  const code = await shop.evaluate(() =>
    localStorage.getItem(
      Object.keys(localStorage).find((k) => k.endsWith(".welcome")),
    ),
  );
  assert(code);
  const data = await request(shop, path);
  const order = {
    requestId: "6e295fd1-348b-4bec-a780-9624f192a291",
    customerName: "Sample Buyer",
    phone: "03001234567",
    city: "Lahore",
    address: "Sample road",
    paymentMethod: data.payments.find((p) => p.kind === "cod").name,
    paymentReference: "",
    items: [{ productId: product.id, quantity: 1 }],
    newsletterCode: code,
    expectedTotal: 0,
  };
  await assert.rejects(request(shop, path + "/orders", "POST", order));
  order.items[0].quantity = 2;
  await assert.rejects(request(shop, path + "/orders", "POST", order));
  assert.equal(
    (await request(shop, path)).products.find((p) => p.id === product.id).stock,
    5,
  );
  await button(admin, "Product Addition").click();
  await button(shop, "Add " + name + " to bag").click();
  await button(shop, "Add " + name + " to bag").click();
  await button(shop, "Bag (2)").click();
  await button(shop, "Checkout").click();
  for (const [label, value] of [
    ["Full name", "Test buyer"],
    ["Phone number", "03001234567"],
    ["Delivery city", "Lahore"],
    ["Delivery address", "Sample road"],
  ])
    await shop.getByLabel(label).fill(value);
  await button(shop, "Place order").click();
  await shop
    .getByRole("heading", { name: "Thank you for your order!" })
    .waitFor();
  assert((await shop.locator(".thankYou").innerText()).includes("300"));
  const [placed] = await request(admin, "/admin/orders");
  assert.equal(placed.newsletterDiscount, 300);
  assert.equal(placed.subtotal, 2000);
  assert.equal(placed.total, 1700 + placed.shipping);
  assert.equal(
    (await request(shop, path)).products.find((p) => p.id === product.id).stock,
    3,
  );
  await admin
    .getByText(/Stock 3 · Packed/)
    .first()
    .waitFor({ timeout: 15000 });
  const retried = await request(shop, path + "/orders", "POST", {
    ...order,
    requestId: placed.requestId,
    expectedTotal: placed.total,
  });
  assert.equal(retried.id, placed.id);
  await assert.rejects(
    request(shop, path + "/orders", "POST", {
      ...order,
      expectedTotal: placed.total,
    }),
  );
  assert.equal(
    (await request(shop, path)).products.find((p) => p.id === product.id).stock,
    3,
  );
  await assert.rejects(
    request(shop, path + "/newsletter", "POST", {
      email: email.toUpperCase(),
      consent: true,
    }),
  );
  await button(admin, "Promotions").click();
  await button(admin, "View subscribers").click();
  await admin.getByText(email + " · Redeemed").waitFor();
  await admin
    .getByLabel("Google web client ID")
    .fill("12345-qa.apps.googleusercontent.com");
  await admin.getByLabel("Require Google sign-in to claim the offer").check();
  await button(admin, "Save newsletter rule").click();
  await admin.getByText("Newsletter rule saved.").waitFor();
  await assert.rejects(
    request(shop, path + "/newsletter", "POST", {
      email: "test@example.test",
      consent: true,
    }),
  );
  await assert.rejects(
    request(shop, path + "/newsletter", "POST", {
      credential: "invalid-google-token",
      consent: true,
    }),
  );
  if (base)
    await assert.rejects(request(shop, "/admin/subscribers"), /401|403/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS " +
      (base ? "PostgreSQL/ASP.NET" : "direct-run") +
      " disclosures, editable stars, newsletter eligibility and consent, rollback, receipt, quantity, refresh, retry, one-time redemption, Google-only enforcement",
  );
} finally {
  await browser.close();
}
