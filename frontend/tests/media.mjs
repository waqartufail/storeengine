import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
try {
  const ctx = await browser.newContext(),
    p = await ctx.newPage();
  const errors = [];
  ctx.on("page", (page) => page.on("pageerror", (e) => errors.push(e.message)));
  p.on("pageerror", (e) => errors.push(e.message));
  p.setDefaultTimeout(8000);
  const base = process.env.TEST_URL,
    local = !base;
  const loginEmail = "media" + Date.now() + "@example.test",
    password = "Media-test-1234!";
  const fixture = "QA-ONLY-POSTEX-TOKEN-28374";
  const img = await readFile(
    new URL("../public/natur-wala.png", import.meta.url),
  );
  const hosted = "https://images.example.test/image/w_600,q_auto/honey.png";
  await ctx.route("https://images.example.test/**", (r) =>
    r.request().url().includes("not-image")
      ? r.fulfill({ contentType: "text/html", body: "<html>image page</html>" })
      : r.fulfill({ contentType: "image/png", body: img }),
  );
  if (local) {
    await p.goto(
      process.env.TEST_LOCAL_FILE
        ? new URL("admin.html", pathToFileURL(process.env.TEST_LOCAL_FILE)).href
        : new URL("../../admin.html", import.meta.url).href,
    );
    await p.getByRole("button", { name: "Sign in", exact: true }).click();
  } else {
    async function auth(path, data, method = "POST") {
      const r = await ctx.request.fetch(base + "/api" + path, {
        method,
        headers: { "X-NW-Request": "portal" },
        data,
      });
      assert(r.ok(), "API " + path + " " + r.status());
      return (await r.text()) ? r.json() : null;
    }
    await auth("/auth/signup", {
      name: "Gallery test",
      adminName: "Merchant",
      email: loginEmail,
      password,
    });
    await auth("/auth/owner/login", {
      email: process.env.QA_OWNER_EMAIL,
      password: process.env.QA_OWNER_PASSWORD,
    });
    const s = (await auth("/owner/stores", undefined, "GET")).find(
      (s) => s.email === loginEmail,
    );
    await auth(
      "/owner/stores/" + s.id,
      { action: "Activate", plan: "Trial" },
      "PUT",
    );
    await auth("/auth/admin/login", { email: loginEmail, password });
    await p.goto(base + "/admin");
  }
  await p
    .getByRole("button", { name: "Product Addition", exact: true })
    .click();
  const editor = p.locator("#product-editor");
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Orange blossom oil");
  await editor.getByLabel("Stock quantity").fill("4");
  await editor.getByLabel("Price (PKR)").fill("600");
  const url = editor.getByLabel("Product image URL (HTTPS)");
  await url.fill("https://images.example.test/not-image");
  await editor.getByText(/This link did not load as an image/).waitFor();
  assert.equal(await url.evaluate((e) => e.validity.valid), false);
  await url.fill(hosted);
  await p.waitForFunction(
    () =>
      document.querySelector("#product-editor input[type=url]").validity.valid,
  );
  await editor.getByRole("button", { name: "Save product" }).click();
  await p.getByRole("status").filter({ hasText: "Product saved." }).waitFor();
  await editor
    .getByLabel("Product name", { exact: true })
    .fill("Orange blossom soap");
  await editor.getByLabel("Stock quantity").fill("3");
  await editor.getByLabel("Price (PKR)").fill("350");
  await editor.getByRole("button", { name: "Save product" }).click();
  await p.getByRole("button", { name: /^Orange blossom soap/ }).waitFor();
  const clip = await readFile(
    new URL("./fixtures/banner.webm", import.meta.url),
  );
  const videoUrl = "https://media.example.test/banner.webm";
  await ctx.route(videoUrl, (r) =>
    r.fulfill({ contentType: "video/webm", body: clip }),
  );
  await p.getByRole("button", { name: "Store", exact: true }).click();
  await p.getByLabel("Banner video URL").fill(videoUrl);
  await p.getByRole("button", { name: "Add social link" }).click();
  await p.getByLabel("Platform name 1").fill("Instagram");
  await p
    .getByLabel("Profile URL 1")
    .fill("https://www.instagram.com/example.shop/");
  const saveBrand = async () => {
    await p.getByRole("button", { name: "Save branding" }).click();
    await p.getByText("Settings saved.", { exact: true }).waitFor();
  };
  await saveBrand();
  const store = await ctx.newPage();
  const href = await p
    .getByRole("link", { name: "Open store" })
    .getAttribute("href");
  await store.goto(new URL(href, p.url()).href);
  const playBanner = async () => {
    const v = store.locator(".heroImg video");
    await v.waitFor();
    await v.evaluate(async (el) => {
      el.muted = true;
      await el.play();
    });
    await store.waitForFunction(
      () => document.querySelector(".heroImg video")?.currentTime > 0,
    );
  };
  await playBanner();
  assert.equal(
    await store.locator(".heroImg video").getAttribute("src"),
    videoUrl,
  );
  assert.equal(
    await store
      .locator("footer")
      .getByRole("link", { name: "Instagram" })
      .getAttribute("href"),
    "https://www.instagram.com/example.shop/",
  );
  await p.getByLabel("Upload banner video").setInputFiles({
    name: "banner.webm",
    mimeType: "video/webm",
    buffer: clip,
  });
  await p.waitForFunction(() =>
    document.querySelector(".promoPreview")?.src.startsWith("data:video"),
  );
  await saveBrand();
  await store.reload();
  await playBanner();
  assert.match(
    await store.locator(".heroImg video").getAttribute("src"),
    /^data:video/,
  );
  const card = store
    .locator(".product")
    .filter({ hasText: "Orange blossom oil" });
  const verify = async (locator) => {
    await locator.waitFor();
    await locator.evaluate((e) => e.decode());
    assert(await locator.evaluate((e) => e.naturalWidth > 0));
  };
  await verify(card.locator("img"));
  assert.equal(await card.locator("img").getAttribute("src"), hosted);
  await p.getByRole("button", { name: "Product Details", exact: true }).click();
  await p
    .getByLabel("Product to configure")
    .selectOption({ label: "Orange blossom oil" });
  await p
    .getByLabel("Full product description")
    .fill("Ingredients\nOrange blossom.\nCare\nKeep the bottle sealed.");
  const description = p.getByLabel("Full product description");
  await description.evaluate((el) => el.setSelectionRange(0, 0));
  await p.getByRole("button", { name: "Heading", exact: true }).click();
  await description.evaluate((el) => {
    const pos = el.value.indexOf("Care");
    el.setSelectionRange(pos, pos);
  });
  await p.getByRole("button", { name: "Subheading", exact: true }).click();
  assert.equal(
    await description.inputValue(),
    "## Ingredients\nOrange blossom.\n### Care\nKeep the bottle sealed.",
  );
  await p
    .getByLabel("Upload cover photo")
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: img });
  const encoded = await p.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 7;
    c.height = 10;
    c.getContext("2d").fillRect(0, 0, 7, 10);
    return c.toDataURL().split(",")[1];
  });
  await p.getByLabel("Upload gallery photos").setInputFiles([
    { name: "front.png", mimeType: "image/png", buffer: img },
    {
      name: "side.png",
      mimeType: "image/png",
      buffer: Buffer.from(encoded, "base64"),
    },
  ]);
  await p.getByAltText("Gallery photo 2", { exact: true }).waitFor();
  await p.getByLabel("Gallery image URL").fill(hosted);
  await p.getByRole("button", { name: "Add URL to gallery" }).click();
  await p.getByAltText("Gallery photo 3", { exact: true }).waitFor();
  await p.getByRole("button", { name: "Move photo 2 earlier" }).click();
  await p.getByRole("button", { name: "Save product details" }).click();
  await p
    .getByRole("status")
    .filter({ hasText: "Product details saved for Orange blossom oil." })
    .waitFor();
  await store.reload();
  await verify(card.locator("img"));
  assert.match(
    await card.locator("img").getAttribute("src"),
    /^data:image\/png/,
  );
  await card
    .getByRole("link", { name: "View Orange blossom oil details" })
    .click();
  await store
    .getByRole("heading", { name: "Orange blossom oil", exact: true })
    .waitFor();
  await store.reload();
  await store.getByRole("heading", { name: "Ingredients", level: 4 }).waitFor();
  await store.getByRole("heading", { name: "Care", level: 5 }).waitFor();
  const suggestions = store.getByRole("region", { name: "Suggested products" });
  assert.match(
    await suggestions.locator("a").first().innerText(),
    /Orange blossom soap/,
  );
  await store.getByText("Keep the bottle sealed.", { exact: false }).waitFor();
  await store.getByRole("button", { name: "View photo 2" }).click();
  await verify(store.locator(".detailPhoto img"));
  assert.equal(
    await store.locator(".detailPhoto img").evaluate((e) => e.naturalWidth),
    7,
  );
  await store.getByRole("button", { name: "Add to bag", exact: true }).click();
  await store.getByRole("link", { name: "Back to store" }).click();
  await store.getByRole("button", { name: "Bag (1)", exact: true }).waitFor();
  await p
    .getByRole("button", { name: "Courier Configuration", exact: true })
    .click();
  const tok = p.getByLabel("PostEx API token", { exact: true });
  await tok.fill(fixture);
  const dir = await mkdtemp(join(tmpdir(), "nw-media-"));
  if (local) {
    const dl = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Download private token file" })
      .click();
    const file = await dl;
    assert.equal(
      file.suggestedFilename(),
      createHash("sha256").update("admin@naturwala.local").digest("hex") +
        ".token",
    );
    await file.saveAs(join(dir, "qa.token"));
    assert.equal(await readFile(join(dir, "qa.token"), "utf8"), fixture);
  } else {
    await p
      .getByRole("button", { name: "Save PostEx token", exact: true })
      .click();
    await p.getByText("PostEx token saved for this store.").waitFor();
    await p.reload();
    await p.getByText("Credential status · Configured").waitFor();
    const json = await (
      await ctx.request.get(base + "/api/admin/settings")
    ).text();
    assert(!json.includes(fixture) && !json.includes("postExSecret"));
  }
  assert.equal(await tok.inputValue(), "");
  const dl = p.waitForEvent("download");
  await p.getByRole("button", { name: "Download GitHub storefront" }).click();
  const exportPath = join(dir, "index.html");
  await (await dl).saveAs(exportPath);
  const html = await readFile(exportPath, "utf8");
  assert(!html.includes(fixture));
  await store.goto(pathToFileURL(exportPath).href);
  await playBanner();
  await store
    .locator("footer")
    .getByRole("link", { name: "Instagram" })
    .waitFor();
  await store
    .getByRole("link", { name: "View Orange blossom oil details" })
    .click();
  await store.getByRole("button", { name: "View photo 2" }).click();
  await verify(store.locator(".detailPhoto img"));
  assert.equal(
    await store.locator(".detailPhoto img").evaluate((e) => e.naturalWidth),
    7,
  );
  await store.getByRole("heading", { name: "Ingredients", level: 4 }).waitFor();
  await store
    .getByRole("region", { name: "Suggested products" })
    .getByRole("link", { name: /Orange blossom soap/ })
    .click();
  await store
    .getByRole("heading", { name: "Orange blossom soap", exact: true })
    .waitFor();
  console.log(
    "PASS uploaded and remote video playback, footer link, description headings and related-product navigation in store and exported Pages file",
  );
  await p.getByRole("button", { name: "Store", exact: true }).click();
  await p.getByRole("button", { name: "Remove video", exact: true }).click();
  await p
    .getByRole("button", { name: "Remove social link 1", exact: true })
    .click();
  await saveBrand();
  await store.goto(new URL(href, p.url()).href);
  await store.locator(".heroImg img").waitFor();
  assert.equal(await store.locator("footer a, .heroImg video").count(), 0);
  console.log(
    "PASS removing a banner clip restores its image, and removing a social link clears it from the footer",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS " +
      (local ? "local HTML" : "server") +
      " URL preview, invalid link, CDN comma URL, uploaded cover, multiple uploaded/linked gallery images, ordering, direct details, cart, PostEx setup and private-data-free storefront export",
  );
} finally {
  await browser.close();
}
