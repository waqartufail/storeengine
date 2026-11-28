import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { descriptionBlocks, writeTable } from "../src/descriptionBlocks.js";

const special = [
  ["Part", "Description"],
  ["A | B", "USB \\ Type C"],
  ["Empty", ""],
];
assert.deepEqual(descriptionBlocks(writeTable(special))[0].rows, special);
assert.deepEqual(
  descriptionBlocks("A | B\n| plain text |").map((b) => b.type),
  ["p"],
);
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
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
  const btn = (p, name) => p.getByRole("button", { name, exact: true });
  const base = process.env.TEST_URL;
  if (base) {
    async function api(path, method = "GET", data) {
      const r = await ctx.request.fetch(base + "/api" + path, {
        method,
        data,
        headers: { "X-NW-Request": "portal" },
      });
      const text = await r.text();
      assert(r.ok(), path + " " + r.status());
      return text ? JSON.parse(text) : null;
    }
    const email = "phone-" + Date.now() + "@example.test",
      password = "QA-mobile-details-123";
    await api("/auth/signup", "POST", {
      name: "Mobiles",
      adminName: "Merchant",
      email,
      password,
    });
    await api("/auth/owner/login", "POST", {
      email: process.env.QA_OWNER_EMAIL,
      password: process.env.QA_OWNER_PASSWORD,
    });
    const s = (await api("/owner/stores")).find((x) => x.email === email);
    await api("/owner/stores/" + s.id, "PUT", {
      action: "Activate",
      plan: "Trial",
    });
    await api("/auth/admin/login", "POST", { email, password });
    await admin.goto(base + "/admin");
  } else {
    await admin.goto(new URL("../../admin.html", import.meta.url).href);
    await btn(admin, "Sign in").click();
  }
  const storeUrl = new URL(
    await admin.getByRole("link", { name: /Open store/ }).getAttribute("href"),
    admin.url(),
  ).href;
  await btn(admin, "Product Addition").click();
  const product = admin.locator("#product-editor");
  await product.getByLabel("Product name", { exact: true }).fill("Demo phone");
  await product.getByLabel("Stock quantity").fill("3");
  await product.getByLabel("Price (PKR)").fill("95000");
  await btn(admin, "Save product").click();
  await admin.getByText("Product saved.", { exact: true }).waitFor();
  await btn(admin, "Product Details").click();
  await admin
    .getByLabel("Product to configure")
    .selectOption({ label: "Demo phone" });
  const box = admin.getByLabel("Full product description");
  await box.fill(
    "## Phone features\nDual SIM\nOLED display\n\nInsert SIM\nPower on",
  );
  function select(from, to) {
    return box.evaluate(
      (el, [a, b]) => {
        const start = el.value.indexOf(a);
        el.setSelectionRange(start, el.value.indexOf(b, start) + b.length);
      },
      [from, to],
    );
  }
  await select("Dual SIM", "OLED display");
  await btn(admin, "Bullet list").click();
  await select("Insert SIM", "Power on");
  await btn(admin, "Numbered list").click();
  await box.focus();
  await box.press("Control+End");
  await box.press("Enter");
  await box.pressSequentially("Choose language");
  await box.press("Enter");
  await box.press("Enter");
  assert((await box.inputValue()).endsWith("3. Choose language\n"));
  await btn(admin, "Insert table").click();
  assert(await btn(admin, "Save product details").isDisabled());
  await admin.getByLabel("Row 1, column 1", { exact: true }).fill("RAM");
  await admin.getByLabel("Row 1, column 2", { exact: true }).fill("8 GB");
  await btn(admin, "Add row").click();
  await admin.getByLabel("Row 2, column 1", { exact: true }).fill("Storage");
  await admin
    .getByLabel("Row 2, column 2", { exact: true })
    .fill("128 GB | expandable");
  await btn(admin, "Add column").click();
  await btn(admin, "Remove column 3").click();
  await btn(admin, "Add row").click();
  await btn(admin, "Remove row 3").click();
  await btn(admin, "Apply table").click();
  await btn(admin, "Edit table 1").click();
  await admin.getByLabel("Row 1, column 2").fill("12 GB");
  await btn(admin, "Cancel table edit").click();
  await admin.getByText("Preview description", { exact: true }).click();
  const check = async (p) => {
    const details = p.locator(".formattedDetails");
    await details
      .getByRole("cell", { name: "128 GB | expandable", exact: true })
      .waitFor();
    assert.deepEqual(await details.locator("ul li").allTextContents(), [
      "Dual SIM",
      "OLED display",
    ]);
    assert.deepEqual(await details.locator("ol li").allTextContents(), [
      "Insert SIM",
      "Power on",
      "Choose language",
    ]);
    assert.deepEqual(await details.locator("th").allTextContents(), [
      "Feature",
      "Specification",
    ]);
    assert.equal(await details.locator("tbody tr").count(), 2);
  };
  await check(admin);
  await admin.getByRole("cell", { name: "8 GB", exact: true }).waitFor();
  await btn(admin, "Save product details").click();
  await admin.getByText("Product details saved for Demo phone.").waitFor();
  await admin.reload();
  await admin
    .getByLabel("Product to configure")
    .selectOption({ label: "Demo phone" });
  await btn(admin, "Edit table 1").click();
  await admin.getByLabel("Row 1, column 2").fill("12 GB");
  await btn(admin, "Apply table").click();
  await btn(admin, "Save product details").click();
  await admin.getByText("Product details saved for Demo phone.").waitFor();
  await shop.goto(storeUrl);
  await shop.getByRole("link", { name: "View Demo phone details" }).click();
  await shop.reload();
  await check(shop);
  await shop.getByRole("cell", { name: "12 GB", exact: true }).waitFor();
  for (const w of [320, 390, 1280]) {
    await shop.setViewportSize({ width: w, height: 780 });
    assert(
      await shop.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      "page overflow at " + w,
    );
  }
  if (!base) {
    const downloading = admin.waitForEvent("download");
    await btn(admin, "Download GitHub storefront").click();
    const path = join(await mkdtemp(join(tmpdir(), "nw-pdp-")), "index.html");
    await (await downloading).saveAs(path);
    await shop.goto(pathToFileURL(path).href);
    await shop.getByRole("link", { name: "View Demo phone details" }).click();
    await check(shop);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS " +
      (base ? "server / PostgreSQL" : "local / customer export") +
      " mobile phone PDP: list formatting and continued numbering, table creation, editing, cancellation, escaped cell values, persistence, responsive widths.",
  );
} finally {
  await browser.close();
}
