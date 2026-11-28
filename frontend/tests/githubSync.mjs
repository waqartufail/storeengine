// An isolated GitHub API/raw-content transport. No real repo or credentials are used.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
const files = new Map(),
  commits = new Map(),
  errors = [],
  token = "synthetic-github-test-key";
let deny = false,
  writes = 0;
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const start = "https://qa-shop.github.io/catalog/";
const data = async (f) =>
  readFile(new URL("../../github-pages/" + f, import.meta.url));
const fixture = await readFile(
  new URL("./fixtures/banner.webm", import.meta.url),
);
async function session(mobile = false) {
  const ctx = await browser.newContext(
      mobile ? { viewport: { width: 360, height: 780 }, isMobile: true } : {},
    ),
    p = await ctx.newPage();
  p.setDefaultTimeout(14000);
  p.on("pageerror", (e) => errors.push(e.message));
  await ctx.route("**/*", async (r) => {
    const q = r.request(),
      u = new URL(q.url()),
      json = (body, status = 200) => r.fulfill({ json: body, status });
    if (q.method() === "OPTIONS")
      return r.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,PUT,OPTIONS",
        },
      });
    if (u.hostname === "qa-shop.github.io")
      return r.fulfill({
        body: await data(
          u.pathname.endsWith("admin.html") ? "admin.html" : "index.html",
        ),
        contentType: "text/html",
      });
    if (u.hostname === "clip.example.test")
      return r.fulfill({ body: fixture, contentType: "video/webm" });
    if (u.hostname === "api.github.com") {
      assert.match(u.pathname, /^\/repos\/qa-shop\/catalog(\/|$)/);
      if (!u.pathname.includes("/contents/"))
        return json({ default_branch: "trunk", private: false });
      const file = u.pathname.split("/contents/")[1],
        old = files.get(file);
      if (q.method() === "GET") {
        if (q.headers().accept === "application/vnd.github.raw+json")
          return json(commits.get(u.searchParams.get("ref"))?.value, 200);
        return old
          ? json({
              sha: old.sha,
              content: Buffer.from(JSON.stringify(old.value)).toString(
                "base64",
              ),
            })
          : json({}, 404);
      }
      assert.equal(q.headers().authorization, "Bearer " + token);
      if (deny)
        return json({ message: "Contents write permission required" }, 403);
      const b = q.postDataJSON();
      assert.equal(b.branch, "trunk");
      if (b.sha !== old?.sha) return json({ message: "conflict" }, 409);
      const decoded = Buffer.from(b.content, "base64").toString("utf8");
      assert(!decoded.includes(token));
      assert(!/"orders"|"identity"|"couriers"|"adminEmail"/.test(decoded));
      const value = JSON.parse(decoded),
        sha = createHash("sha1").update(decoded).digest("hex");
      const commit = createHash("sha1").update(String(++writes)).digest("hex");
      files.set(file, { value, sha });
      commits.set(commit, { value, sha });
      return json(
        { content: { sha }, commit: { sha: commit } },
        old ? 200 : 201,
      );
    }
    if (u.hostname === "raw.githubusercontent.com") {
      assert(!q.headers().authorization);
      const [, owner, repo, ref, ...rest] = u.pathname.split("/");
      assert.equal(owner, "qa-shop");
      assert.equal(repo, "catalog");
      const entry =
        ref === "HEAD" ? files.get(rest.join("/")) : commits.get(ref);
      return entry ? json(entry.value) : json({}, 404);
    }
    return r.abort();
  });
  return p;
}
try {
  const admin = await session(),
    phone = await session(true);
  await admin.goto(start + "admin.html");
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await phone.goto(start);
  await phone
    .getByRole("heading", { name: "Good things. Better living." })
    .waitFor();
  const tab = (label) =>
    admin.getByRole("button", { name: label, exact: true }).click();
  await tab("Publish & sync");
  assert.equal(await admin.getByLabel("Hosted store origin").count(), 0);
  await admin.getByLabel("GitHub publishing token").fill(token);
  await tab("Connect and sync");
  await admin.getByText(/Synced to GitHub at/).waitFor();
  await tab("Hero banner");
  await admin
    .getByLabel("Main heading", { exact: true })
    .fill("شہد from the hills");
  await admin.getByLabel("Second heading line").fill("");
  await admin.getByLabel("Seconds per slide").fill("2");
  await admin
    .getByLabel("Banner video URL")
    .fill("https://clip.example.test/clip.webm");
  const png = await readFile(
    new URL("../public/natur-wala.png", import.meta.url),
  );
  await admin
    .getByLabel("Store banner", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: png });
  await admin.getByAltText("Store banner preview").waitFor();
  await tab("Save section");
  await phone
    .getByRole("heading", { name: "شہد from the hills", exact: true })
    .waitFor();
  await phone.locator(".bannerStage video").waitFor();
  assert(
    await phone
      .locator(".bannerStage video")
      .evaluate(
        (v) =>
          v.autoplay &&
          v.muted &&
          !v.controls &&
          v.playsInline &&
          getComputedStyle(v).objectFit === "cover",
      ),
  );
  await phone.locator(".bannerStage img").waitFor({ timeout: 5000 });
  assert(
    await phone
      .locator(".hero")
      .evaluate(
        (e) =>
          e.getBoundingClientRect().width >= innerWidth - 1 &&
          document.documentElement.scrollWidth <= innerWidth,
      ),
  );
  const fresh = await session(true);
  await fresh.goto(start);
  await fresh.getByRole("heading", { name: "شہد from the hills" }).waitFor();
  // A test checkout on an independent shopper must survive the next catalog publish.
  async function sampleStock(page, buy = false) {
    return page.evaluate(async (buy) => {
      const api = window.NW_LOCAL.request,
        path = "/stores/" + window.NW_LOCAL.slug;
      const data = await api(path),
        p = data.products.find((x) => x.name === "Wildflower Honey");
      if (!buy) return p.stock;
      await api(path + "/orders", "POST", {
        requestId: crypto.randomUUID(),
        customerName: "Inventory QA",
        phone: "03001234567",
        city: "Lahore",
        address: "Test address",
        paymentMethod: data.payments.find((x) => x.kind === "cod").name,
        paymentReference: "",
        expectedTotal:
          p.salePrice + (p.shippingCharge || data.shipping.baseCharge),
        items: [{ productId: p.id, quantity: 1 }],
      });
      return p.stock;
    }, buy);
  }
  const initialStock = await sampleStock(fresh, true);
  assert.equal(await sampleStock(fresh), initialStock - 1);
  await tab("Store story");
  await admin.getByLabel("Story text").fill("Bottled in small batches.");
  deny = true;
  await tab("Save section");
  await admin.getByText(/Sync pending.*403/).waitFor();
  deny = false;
  await tab("Publish & sync");
  await tab("Sync now");
  await phone.getByText("Bottled in small batches.").waitFor();
  await tab("Category showcase");
  await admin.getByLabel("Show this section").uncheck();
  await tab("Save section");
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await admin.getByText(/Synced to GitHub at/).waitFor();
  await tab("Featured products");
  await admin.getByLabel("Section heading").fill("This week’s pick");
  await admin.getByLabel("Mint Green Tea", { exact: true }).check();
  await tab("Save section");
  await phone.getByRole("heading", { name: "This week’s pick" }).waitFor();
  assert.equal(await phone.locator(".categoryShelf").count(), 0);
  assert.equal(await phone.locator(".featuredShelf a").count(), 1);
  await phone.locator(".featuredShelf a").click();
  await phone
    .getByRole("heading", { name: "Mint Green Tea", exact: true })
    .waitFor();
  const second = await session();
  await second.goto(start + "admin.html");
  await second.getByRole("button", { name: "Sign in", exact: true }).click();
  await second
    .getByRole("button", { name: "Publish & sync", exact: true })
    .click();
  await second.getByLabel("GitHub publishing token").fill(token);
  await second.getByRole("button", { name: "Connect and sync" }).click();
  await second.getByText(/published from another session/).waitFor();
  second.on("dialog", (d) => d.accept());
  await second
    .getByRole("button", { name: "Load published catalog into this Admin" })
    .click();
  await second
    .getByRole("button", { name: "Hero banner", exact: true })
    .click();
  assert.equal(
    await second.getByLabel("Main heading", { exact: true }).inputValue(),
    "شہد from the hills",
  );
  assert(
    !(
      await admin.evaluate(() =>
        JSON.stringify({ ...localStorage, ...sessionStorage }),
      )
    ).includes(token),
  );
  await tab("Store designer");
  await admin
    .getByLabel("Logo position", { exact: true })
    .selectOption("right");
  await tab("Save design");
  await admin.getByText("Settings saved.", { exact: true }).waitFor();
  await fresh.locator('header[data-logo-align="right"]').waitFor();
  await admin.getByText(/Synced to GitHub at/).waitFor();
  const home1 = await admin
    .getByRole("link", { name: /Open store/ })
    .getAttribute("href");
  assert.equal(await sampleStock(fresh), initialStock - 1);
  const merchantShop = await admin.context().newPage();
  await merchantShop.goto(home1);
  await merchantShop
    .getByRole("button", { name: "Add Wildflower Honey to bag" })
    .waitFor();
  const before = await sampleStock(merchantShop, true);
  assert.equal(
    (
      await admin.evaluate(() => window.NW_LOCAL.request("/admin/products"))
    ).find((p) => p.name === "Wildflower Honey").stock,
    before - 1,
  );
  // Observe the committed catalog on a fresh device before changing merchants.
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && (await sampleStock(fresh)) !== initialStock - 2)
    await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(await sampleStock(fresh), initialStock - 2);
  await merchantShop.close();
  console.log(
    "PASS shopper checkout survives republication and merchant-browser checkout updates Admin stock and the public catalog.",
  );
  const oldPointer = files.get("nw-store/current.json").sha;
  await tab("Sign out");
  const email = "two@example.test",
    password = "Testing-store-two-123";
  await admin.getByLabel("Admin name", { exact: true }).fill("Second merchant");
  await admin.getByLabel("Store name", { exact: true }).fill("Store Two");
  await admin.getByLabel("Admin email").fill(email);
  await admin.getByLabel("New password").fill(password);
  await tab("Request approval");
  await admin.getByText(/Registration received/).waitFor();
  const owner = await admin.context().newPage();
  owner.setDefaultTimeout(12000);
  owner.on("dialog", (d) => d.accept());
  await owner.route(start + "owner.html", (r) =>
    r.fulfill({
      contentType: "text/html",
      path: new URL("../../owner.html", import.meta.url).pathname,
    }),
  );
  await owner.goto(start + "owner.html");
  await owner.getByRole("button", { name: "Sign in", exact: true }).click();
  const row = owner.locator("article").filter({ hasText: "Store Two" });
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await row.getByText("Active", { exact: true }).waitFor();
  await admin.getByLabel("Email", { exact: true }).fill(email);
  await admin.getByLabel("Password", { exact: true }).fill(password);
  await tab("Sign in");
  await tab("Product Addition");
  const editor = admin.locator("#product-editor");
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Second store dates");
  await editor.getByLabel("Price (PKR)").fill("780");
  await editor.getByLabel("Stock quantity").fill("4");
  await tab("Save product");
  await admin.getByText("Product saved.", { exact: true }).waitFor();
  const open = admin.getByRole("link", { name: /Open store/ });
  const home2 = await open.getAttribute("href");
  assert.notEqual(home1, home2);
  const pop = admin.waitForEvent("popup");
  await open.click();
  const preview = await pop;
  const dates = (p) =>
    p.getByRole("heading", { name: "Second store dates", exact: true });
  await dates(preview).waitFor();
  assert.equal(await preview.locator(".product").count(), 1);
  await phone.goto(home2);
  await phone.getByText(/This store has no published catalog/).waitFor();
  await tab("Publish & sync");
  assert.equal(
    await admin
      .getByRole("link", { name: home2, exact: true })
      .getAttribute("href"),
    home2,
  );
  await admin.getByLabel("GitHub publishing token").fill(token);
  await tab("Connect and sync");
  await admin.getByText(/Synced to GitHub at/).waitFor();
  await dates(phone).waitFor();
  assert.equal(
    await phone.locator("header").getAttribute("data-logo-align"),
    "original",
  );
  await tab("Store");
  assert.equal(
    await admin
      .getByRole("link", { name: "Open store page" })
      .getAttribute("href"),
    home2,
  );
  assert.equal(files.get("nw-store/current.json").sha, oldPointer);
  await phone
    .getByRole("link", { name: "View Second store dates details" })
    .click();
  await dates(phone).waitFor();
  await phone.reload();
  await dates(phone).waitFor();
  await phone.getByRole("link", { name: /Back to store/ }).click();
  await phone
    .getByRole("button", { name: "Add Second store dates to bag" })
    .click();
  await phone.goto(home1);
  await phone
    .getByRole("heading", { name: "Wildflower Honey", exact: true })
    .waitFor();
  await phone.getByRole("button", { name: "Bag (0)", exact: true }).waitFor();
  assert.equal(await dates(phone).count(), 0);
  await phone.goto(home2);
  await phone.getByRole("button", { name: "Bag (1)", exact: true }).waitFor();
  await phone.goto(start + "index.html#/store/unknown-99");
  await phone.getByText(/This store has no published catalog/).waitFor();
  assert.equal(await phone.locator(".product").count(), 0);
  console.log(
    "PASS two approved merchants in one repo, actual Open store before sync, unpublished phone link, post-sync catalog, unchanged first publication, product deep link, independent bags and unknown store.",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS auto/manual GitHub catalog publish, open and fresh phone sessions, Unicode, full-width cover, timed media, failure/retry, stale publisher protection and draft import.",
  );
} finally {
  await browser.close();
}
