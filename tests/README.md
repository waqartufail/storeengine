# Verification

The release was exercised against a running ASP.NET Core 8 API and PostgreSQL 16.16. Chromium executed the customer and admin workflow against a Vite development server and again against the production React bundle served by Nginx. The production run used the supplied Nginx routes with local test ports and a temporary document root.

| Area | Checks |
|---|---|
| Registration and access | Duplicate email, denied pending login, owner-only controls, all four plan types, automatic expiry, deactivation and rejection, session invalidation, reactivation and sign-out |
| Store isolation | Two merchants, independent settings/catalogs, denied cross-store edits and order reads, disabled-store checkout rejection |
| Products, branding and payments | Click-to-edit, removal, filters, fixed and percentage discounts, ten theme choices, uploaded logo/banner and payment QR, browser title, custom courier and payment method, hosted-card URL validation |
| Product detail pages | Both photo sources, rejection of an invalid image link, CDN URL containing a comma, decoded cover and gallery images, gallery ordering, detail link refresh, bag persistence and public export |
| Store content and discovery | Formatting controls produce real headings. A sample WebM plays from a URL and an upload. Banner and footer edits survive export and removal. Related products open their detail pages. Ranking tests cover recent interests, store catalog boundaries and unavailable items. |
| Orders | Checkout through the storefront, filtering by number/product/from/to/status, direct order-detail navigation, manual payment verification and tracking |
| Financial calculations | One fee across multiple products, exact 5 kg boundary, 5.001 kg excess, changed threshold, stale totals, duplicate submit and concurrent purchase of the final unit |
| Database | Fresh initialization, applying the upgrade twice to a fixture of original-schema columns, private unassigned records, explicit assignment and preserved historical totals |
| PostEx | Masked server token save, offline private-file download, per-merchant credentials, token exclusion from customer exports. Stub HTTP transport checks destination, method, token header, normalized phone, reference, item count, COD and prepaid amounts, tracking parsing, missing confirmation and failure response |
| Layout | Chromium viewport checks at 320, 360, 390, 768 and 1280 pixels, including mobile admin checkout management and receipt screens |

## Repeat against a disposable deployment

The tests register stores and create or change sample orders. Use a dedicated QA database and test owner. Set the environment variables in your terminal. In PowerShell use `$env:TEST_URL="http://localhost:5173"` and the same syntax for the other variables.

```sh
export TEST_URL=http://localhost:5173
export QA_OWNER_EMAIL='your-test-owner@example.test'
export QA_OWNER_PASSWORD='your-test-owner-password'
python3 tests/api_smoke.py
dotnet run --project tests/PostExContract
cd frontend
npm ci
npx playwright-core install chromium --only-shell
node tests/browser.mjs
node tests/media.mjs
node tests/suggestions.mjs
```

The browser script accepts `CHROMIUM_PATH` to use an existing Chromium executable. The API test uses Python 3 standard libraries. To check clock expiry and SQL migration, install `psycopg[binary]` into your test Python environment and set `QA_DB_DSN` to your **QA** PostgreSQL DSN. Rerun the API test with that variable set and run `python3 tests/database_checks.py` from the project root. The SQL test creates a temporary test schema and rolls it back. The expiry test backdates only its own synthetic tenant. For the packaged Compose layout, PostgreSQL is private to the service network, so run direct database checks on that network or against a disposable local PostgreSQL instance.

## External verification still required

Live PostEx booking needs a merchant token and account pickup configuration. Other courier services support manual dispatch. The online payment methods use merchant instructions, QR images or hosted payment links with manual reconciliation. No live money transfer, card charge, WhatsApp send or external shipment was made. Docker Engine and Windows Desktop were unavailable in the build environment, so the Compose services were exercised as native processes on Linux. Physical-device, Safari and Firefox testing was outside this run.

## Direct-open and GitHub Pages editions

The local build generates three standalone HTML portals and a customer-only Pages file. Run `npm ci` and `npm run build:local` inside frontend to rebuild them. Set TEST_LOCAL_FILE to the absolute path of the extracted store.html, then run `node frontend/tests/browser.mjs` from the project root. The test opens the separate role pages in an offline Chromium context and verifies product-specific promotions, checkout confirmation, order-number consistency, reload, deactivation and mobile layouts.

Run `node frontend/tests/pages.mjs` for the customer-only static tests. It serves the Pages file under a local repository subpath, checks that management pages and credentials are absent, places a discounted order, reloads the confirmation, and exercises the merchant’s storefront export. To also test shared orders against a disposable PostgreSQL/API deployment, configure its Pages__Origin as http://127.0.0.1:5197 and supply TEST_URL, QA_OWNER_EMAIL and QA_OWNER_PASSWORD to the test process. The test creates a synthetic store and compares the cross-origin checkout confirmation with its admin order record. No actual GitHub site or merchant carrier was contacted.

Run the same media suite against the direct-open portals by setting TEST_LOCAL_FILE to the absolute path of store.html and unsetting TEST_URL. The URL-image tests use a local browser fixture with real image bytes. Availability of individual third-party image hosts is outside the fixture.

## Mobile publishing and merchandising regression

With TEST_URL, the QA owner variables and Pages__Origin configured as above, run `node frontend/tests/mobileStore.mjs`. It downloads the actual connected Pages export, serves it at a separate origin and observes a desktop edit from a different mobile browser context without reloading. It checks category navigation from the detail page, reload, discounted-price and creation-order sorting, uploaded slides, social icon URLs and localized UI. Image frame and viewport bounds are checked using both tall and wide photos at 320, 390, 768 and 1280 px. Chromium mobile emulation is used.

The browser and Pages suites verify net sizes in g and ml on product cards, detail pages and the bag. The API suite changes net size without changing shipping and then crosses 5 kg by changing only packed weight. It also checks invalid units, legacy edits, clearing size and purchase-time size snapshots.

## GitHub Pages publishing and homepage sections

Build the standalone files with `npm run build:local` in frontend, then run `node tests/githubSync.mjs`. The test intercepts GitHub Contents and immutable raw file reads. It exercises auto-save, manual retry after denied writes, an already-open isolated phone, a fresh phone, Unicode hero text, cover sizing, automatic slides, control-free video, stale drafts and loading the published catalog on a second Admin. Real GitHub credentials, provider cache timing and physical-device autoplay need a deployment test.

The GitHub publishing suite also registers and approves a second merchant under the same repository. It clicks the dashboard’s Open store link before first sync, publishes the second store, checks both storefronts on a separate browser and verifies isolated shopping bags and product links.

Run `node tests/storeDesigner.mjs` from frontend after `npm run build:local` to check actual unsaved previews, independently aligned footer elements, logo shape, ordering, new and hidden custom sections, working desktop sidebar filters, narrow viewports and saved designs. The GitHub transport suite checks a published layout reaches another browser and another store keeps its own layout.

Run `node tests/productFormatting.mjs` under frontend for product description lists and editable tables. It verifies retained headings, formatting selected lines, continued numbering, editing a table after save and reload, cell escaping, mobile widths and an exported customer storefront. Set TEST_URL and the QA owner variables to run it against the server and PostgreSQL.


## Checkout stock, star ratings, newsletter rules and product disclosures

Run these from the frontend directory after installing its dependencies and browser. Rebuild the HTML packages with `npm run build:local` after editing source.

- `node tests/customerOffers.mjs` checks all four features in the direct-run portals. To run the same tests against ASP.NET and PostgreSQL, supply the disposable deployment’s TEST_URL, QA_OWNER_EMAIL and QA_OWNER_PASSWORD. The hosted case uses independent customer and Admin browser contexts.
- `node tests/googleNewsletter.mjs` tests the Google button and signature, audience, expiry and email-verification checks in the Pages storefront with synthetic provider keys and a mock identity endpoint. A merchant OAuth client and authorized web origin are needed for a live account test.
- `node tests/githubSync.mjs` exercises a simulated GitHub publish, checkout from the Admin browser, and preservation of an independent shopper’s remaining stock after republication.
- `node tests/pages.mjs` with the hosted environment checks a cross-origin Pages checkout against PostgreSQL. Set Pages__Origin on the API to http://127.0.0.1:5197 for this test.
