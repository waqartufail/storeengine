import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

// Provider contract test with a synthetic signing key. No Google account or live service is used.
const client = "12345-newsletter.apps.googleusercontent.com";
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "test-key",
  kty: "RSA",
  alg: "RS256",
};
const tokenFor = (extra = {}) => {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const segments =
    encode({ alg: "RS256", kid: jwk.kid }) +
    "." +
    encode({
      aud: client,
      iss: "https://accounts.google.com",
      exp: Math.floor(Date.now() / 1000) + 3600,
      email: "verified@example.test",
      email_verified: true,
      ...extra,
    });
  return (
    segments +
    "." +
    sign("RSA-SHA256", Buffer.from(segments), privateKey).toString("base64url")
  );
};
const template = await readFile(
  new URL("../../github-pages/index.html", import.meta.url),
  "utf8",
);
const html = template.replace(
  /(<script type="application\/json" id="catalog-data">)([^<]+)(<\/script>)/,
  (_, open, body, close) => {
    const data = JSON.parse(body);
    data.newsletter = {
      enabled: true,
      percent: 15,
      minimum: 0,
      googleOnly: true,
      googleClientId: client,
    };
    return open + JSON.stringify(data) + close;
  },
);
const browser = await chromium.launch({
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  const ctx = await browser.newContext(),
    page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  let widgets = 0;
  await ctx.route("https://example.test/**", (r) =>
    r.fulfill({ contentType: "text/html", body: html }),
  );
  await ctx.route("https://accounts.google.com/gsi/client", (r) => {
    widgets++;
    return r.fulfill({
      contentType: "text/javascript",
      body: `window.google={accounts:{id:{initialize(opts){this.opts=opts},renderButton(el){const btn=document.createElement("button");btn.textContent="Sign in with Google";btn.onclick=()=>this.opts.callback({credential:${JSON.stringify(tokenFor())}});el.append(btn)}}}}`,
    });
  });
  await ctx.route("https://www.googleapis.com/oauth2/v3/certs", (r) =>
    r.fulfill({
      json: { keys: [jwk] },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.goto("https://example.test/shop/index.html");
  await page
    .getByRole("heading", { name: "Newsletter welcome offer" })
    .waitFor();
  assert.equal(widgets, 0);
  const attempts = [
    tokenFor({ aud: "different-client" }),
    tokenFor({ email_verified: false }),
    tokenFor({ exp: 1 }),
    tokenFor().replace(/\.[^.]+$/, ".AA"),
  ];
  for (const credential of attempts) {
    const accepted = await page.evaluate(async (credential) => {
      const a = window.NW_LOCAL;
      try {
        await a.request("/stores/" + a.slug + "/newsletter", "POST", {
          consent: true,
          credential,
        });
        return true;
      } catch {
        return false;
      }
    }, credential);
    assert.equal(accepted, false);
  }
  await page.getByLabel(/I agree to receive/).check();
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  await page.getByText("Your welcome discount is ready.").waitFor();
  assert.equal(widgets, 1);
  console.log(
    "PASS Google newsletter button, required consent, signed test identity, rejection of invalid signature, audience, verification and expiry (mock provider).",
  );
} finally {
  await browser.close();
}
