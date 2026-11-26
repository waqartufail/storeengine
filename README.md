# Natur-Wala & Co.

## Direct start

Extract the ZIP into a folder and open the HTML file for your role in Chrome or Edge. Each page runs by double-click. Keep all three in the same directory and use the same browser profile for shared local testing.

| File | Opens |
|---|---|
| store.html | Customer storefront. The sample catalog opens immediately. RUN-LOCAL.html also opens this page. |
| admin.html | Merchant signup and login, product promotions, orders, payments and store settings. |
| owner.html | Platform owner login, registration approvals, plans and deactivation. Keep this file in your private working folder. |

## Publish the customer build for testing on GitHub Pages

1. Use the **Natur-Wala-GitHub-Pages.zip** customer package, or open **github-pages** in this full package. Upload its extracted **index.html** to the root of your GitHub test repository. This is the complete customer app and includes its styles, scripts and sample catalog.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select your branch (usually main) and **/(root)**, then **Save**. Share the Pages site address with testers.
3. Keep the full source ZIP and the two management pages private. Publishing just the customer file keeps owner/admin screens, test logins, management API actions, historical orders and merchant records out of your public upload.

The included customer test store shows a 10% Wildflower Honey offer. At PKR 850 list price, one jar is PKR 765 plus PKR 200 shipping. Successful checkout shows a **Thank you for your order!** screen and the saved **order number**. Refresh keeps that confirmation in the same tab. **Continue shopping** returns to the store with an empty bag.

### Publish your own products and promotions

Open admin.html, sign in and choose **Promotions → Product to promote**. Choose a preset or enter a custom percentage/fixed PKR discount and label. Preview the sale price and choose **Save promotion**. Choose **None** and save to remove it. The original product form supports promotions as well. Discounts appear on the product, in the bag and on the saved order item.

For the three local pages, the storefront uses your saved changes on reload. To give GitHub testers your own catalog, use **Download GitHub storefront** in the admin dashboard, then replace the repository's index.html with the downloaded file. The export includes customer-facing branding, enabled payment instructions, shipping rules and current product offers. Browser-only test orders are stored per tester’s browser. Use sample customer and payment details for this mode.

### Product photos and detail pages

1. In **Admin → Product Addition**, click a product to edit it. Paste a public HTTPS image address into **Product image URL**, or use **Upload cover photo**. Wait for the preview and save the product. If a website blocks image embedding or the link opens a web page, upload the picture instead.
2. Open **Admin → Product Details**, select the product and enter its full description. You can replace the cover here and add up to **eight additional photos**. Select several PNG, JPEG or WebP files at once, or add gallery URLs individually. Use the arrow buttons to reorder photos, then choose **Save product details**. Individual uploads can be up to 16 MB. The browser resizes larger originals before saving.
3. On the store, click the product name or picture. The product has its own link, photo gallery, full description, price, stock and bag button. Reload the local storefront after editing. For a static GitHub store, export and publish the updated **index.html** after your changes. Uploaded photos travel with this export. Linked photos need their original image host to remain accessible.

### Headings, home-page video and footer links

In **Product Details**, place the cursor on a description line and choose **Heading** or **Subheading**. You can type over the selected text, preview the description and save. Existing plain-text descriptions keep their line breaks.

In **Admin → Store**, upload an MP4 or WebM up to 8 MiB or paste a direct HTTPS video URL. A video-hosting page URL will not play as a video file. **Save branding** publishes the clip in the home-page banner. The video starts muted where the browser permits, has playback controls and uses the banner image as its poster and fallback. Removing the clip restores the image. A hosted video URL keeps the size of large storefront exports down.

In the same Store form, use **Add social link** for each platform. Enter its display name and HTTPS profile link and save. The links appear in the customer footer. After local edits, export a fresh **index.html** to update GitHub Pages.

Below the product details, **You may also like** links to up to four other in-stock items in the same store. Suggestions use product category, similar names, recently viewed categories in the current browser tab and the shopping bag. Other available products fill unused spots. Browsing history stays in the tab.

### Optional shared testing with the server

To have all testers read live promotions and send orders to the merchant’s central order list, deploy the included server edition at an HTTPS origin reachable by testers. Approve the store and configure its products there. In the API environment, set Pages__Origin to the Pages origin (e.g. https://YOUR-ACCOUNT.github.io, without the repository path) and restart the API. In the published index.html, find the JSON element with id="connection-data" and set apiOrigin to the server origin and slug to the store’s assigned slug. Example:

```json
{"apiOrigin":"https://shop-api.example.com","slug":"your-assigned-store-slug"}
```

The storefront sends catalog and checkout requests without login cookies. The API calculates the final promotional prices and shipping and returns the PostgreSQL order number. Checkout errors leave the bag available for correction or retry. A connected storefront reports connection failures directly. For local testing the API origin may also be an HTTP localhost address. Owner and Admin use the separate authenticated server portals.

GitHub Pages configuration reference: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Local sample accounts

| Local sample login | Email | Password |
|---|---|---|
| Owner | owner@naturwala.local | NaturOwner123! |
| Admin | admin@naturwala.local | NaturAdmin123! |

The local edition saves records in this browser’s IndexedDB for the extracted file. Reopen the same file at the same path in the same browser profile to continue. Clearing browser storage, moving the file or using another browser profile can give you a fresh workspace. Use sample customer data for local testing. **Export data** downloads a readable snapshot of the signed-in store.

Checkout, stock updates, order details and approvals work locally. Live PostEx requests and shared multi-user access use the server edition below. External payment links and WhatsApp require their respective services.

## Server edition

The included React, ASP.NET Core 8, EF Core and PostgreSQL 16 source supports a hosted multi-store application. Server data and local HTML data are independent.

## Server edition setup

1. Install Docker Desktop with Compose v2. On Windows, start Docker Desktop in Linux container mode.
2. Extract the ZIP. Open a terminal **in the extracted project folder**, next to docker-compose.yml.
3. Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD` to a new alphanumeric secret (at least 24 characters recommended). Set `Owner__Email` and `Owner__Password` to your chosen owner login. The owner password must contain 12–128 characters. Keep this file private.
4. Run the commands below. The first build needs internet access to download container images, NuGet packages and npm packages.

```sh
docker compose up --build -d
docker compose ps
docker compose logs api
```

Open **http://localhost:5173**. On Windows, double-clicking `run-server.bat` also walks through initial configuration and starts the stack. Linux/macOS users can run `bash run-server.sh`. A different `WEB_PORT` in .env changes the local URL. The server edition opens at the HTTP address above. The local HTML entry opens its own browser-based workspace.

| Portal | Local URL | First action |
|---|---|---|
| Owner | http://localhost:5173/owner | Sign in with the owner credentials from .env. |
| Admin | http://localhost:5173/admin | Choose **Create a store** and submit a registration. |
| Store directory | http://localhost:5173/store | Open an approved store. |
| Customer storefront | /store/{assigned-slug} | Use **Open store** from the merchant dashboard to get the exact link. |

New stores start empty and pending. Register an admin, open Owner in another tab, select a plan, and click **Activate**. Then sign in at Admin, add a product, and open the store to place the first order. The Owner and Admin sessions use separate cookies.

## Owner plans and data boundaries

| Owner action | Effect |
|---|---|
| Activate · Trial | Opens admin and storefront for 14 days. |
| Activate · Monthly / Yearly | Opens access for one calendar month / year. |
| Activate · Lifetime | Opens access without an expiry date. |
| Deactivate / Reject | Blocks admin operations, public catalog and checkout. Existing records remain available after reactivation. |

Each activation starts the selected term at the current UTC time. Changing or renewing a plan invalidates the previous admin session. Expiry is enforced by the API on access. The store disappears from the public directory when access ends. Browser views refresh access on focus or within 30 seconds. Each merchant manages one store, and the API derives the merchant’s store ID from its authenticated cookie.

## Merchant workflow

- **Product Addition.** Click a stock record to load the edit form. Set **Net quantity** and **Product unit** (g or ml) for the pack size shoppers see. Set **Packed shipping weight (kg)** separately to include packaging. Only the packed weight drives weight-based delivery charges. Existing products retain their original shipping weight and show a size after you enter the labeled contents. Filter by name or stock status. Remove hides a product from the catalog while historical order lines keep their original values.
- **Promotions.** Choose 10% off, 20% off, PKR 100 off, a named custom percentage, or a named fixed amount. One promotion applies per product. The API rounds the discounted unit price to two decimals before multiplying by quantity.
- **Orders Status.** Combine order number, product, local date range and status filters. Click an order number to open its own detail URL. The screen contains delivery details, price snapshots, payment reference, shipping totals, order status and tracking.
- **Courier Configuration.** Set the default shipper, enabled services, pickup codes and dispatch notes. PostEx, TCS, Leopards and M&P are included. Add custom couriers as needed. The default at checkout is captured on the order. For manual bookings, enter the verified tracking number on Order Detail.
- **Payment Configurations.** Enable COD, Easypaisa, JazzCash, bank transfer, hosted card payment or a custom method. Each option supports instructions and a QR image (PNG, JPEG or WebP up to 1 MiB), or an HTTPS QR URL. At least one payment method and one default courier must remain enabled.
- **Store.** Configure store name, logo, banner and browser title. Branding changes preserve the public store URL. The ten original theme palettes in **Themes & Appearance** apply to both storefront and admin.
- **Export data.** Downloads this store’s settings, catalog and order snapshots as JSON. The optional WhatsApp link on an order opens a prefilled customer conversation for the admin to send.

### Shipping example

The highest nonzero shipping fee among the selected products applies once. When all selected product fees are zero, the default base fee applies. Each started kilogram above the included weight adds one extra charge.

With 5 kg included and PKR 50 per extra kg, products with shipping fees of PKR 85 and PKR 40 cost PKR 85 to ship at 5.000 kg, and PKR 135 at 5.001 kg. Checkout calculates the charge again on the server. Catalog, stock or price changes can require the buyer to review the bag.

### PostEx booking

1. In the **server Admin → Courier Configuration → PostEx API token** panel, paste your merchant token and select **Save PostEx token**. The panel shows **Configured** and clears the field. To rotate the token, save its replacement there. The API encrypts each merchant’s credential. Back up the Data Protection key volume (appkeys) along with PostgreSQL.
2. If you only have the double-click **admin.html** open, the same panel can generate a **private token file**. Enter the registered server merchant email and token, choose **Download private token file**, then move it unchanged to **private/postex/** on the server. The file contains the credential. Keep it private and outside your GitHub Pages repository. Compose mounts this folder into the API. Without Docker, set **PostEx__SecretDirectory** to its absolute path. The server first uses the credential saved via Admin, then the optional legacy environment variable **PostEx__Stores__42__Token** (replace 42 with the store ID), then the private file. A local HTML store cannot submit a live shipment.
3. In Courier Configuration, enable PostEx, enter the registered pickup code and select PostEx as the default shipper before checkout. The customer’s phone must be a Pakistani mobile number for API booking.
4. Open the order and choose **Book with PostEx**. For a prepaid order, verify receipt with the payment provider and mark the payment verified first. The worker submits a single shipment and records the returned tracking number. COD sends the order total for collection. Verified prepaid orders send zero.
5. If a request times out, returns an ambiguous response, or the process stops during submission, inspect the merchant portal using reference `NW-{store ID}-{order ID}`. Record the existing tracking number, or confirm that no booking exists before retrying. An interrupted send becomes eligible for manual reconciliation after two minutes.

The adapter uses the PostEx Merchant API v3 create-order endpoint. Provider response parsing and the URL, token header and request payload are covered by the included stub test. Live merchant acceptance requires credentials. TCS, Leopards, M&P and custom courier dispatch are manual.

### Payment collection

For Easypaisa, JazzCash, bank transfers and custom methods, the buyer follows the merchant instructions and enters a reference. For card payments, supply an HTTPS checkout link issued by your card processor. The customer pays on the hosted page and enters the provider reference. The admin must match the **amount, reference and order** against the merchant account before marking a payment verified. This build does not collect card numbers, generate dynamic provider invoices or receive settlement webhooks.

## Database and upgrades

Compose keeps PostgreSQL data in the named pgdata volume and cookie-protection keys in appkeys. Stop services with `docker compose down`. Retain both volumes. The API creates a fresh schema and runs `backend/Database/upgrade.sql` at startup.

**Upgrading the original PostgreSQL deployment.** Back up your database and stop the old stack first. Reuse its Compose project name and database credentials to select the existing volume (for example, `docker compose -p independent-ecommerce up --build -d` if that was its name). Previously shared product/order rows remain unassigned and private. After registering and approving the correct store, verify the old rows belong to it, then run the optional assignment script against that database. It assigns **all unassigned** original products and orders to the chosen store in one transaction. It preserves order-item links. Mixed historical ownership requires an explicit row-by-row mapping.

```sh
# Replace 42 and the database/user names with the intended values.
# Use the same Compose project name on these commands as on startup.
docker compose cp backend/Database/assign-legacy.sql db:/tmp/assign-legacy.sql
docker compose exec db psql -U storeuser -d storedb -v shop_id=42 -f /tmp/assign-legacy.sql
```

The uploaded standalone localStorage demo is preserved in `legacy/original-offline-demo.html` as a separate reference for the original panel, including its demo reset. Its browser data and local demo accounts are not imported into hosted stores. Keep the legacy folder outside the web root. The supplied frontend container serves only the compiled React app.

## Run without Docker

Start PostgreSQL 16 and create a database owned by the application’s DB user. Set the API process variables `ConnectionStrings__Default` (e.g. `Host=localhost;Database=storedb;Username=storeuser;Password=YOUR_PASSWORD`), `Owner__Email`, `Owner__Password` and `ASPNETCORE_URLS=http://127.0.0.1:8080`. Then run `dotnet run --project backend` using .NET SDK 8. In another terminal, run `npm ci` and `npm run dev` inside frontend with Node 22+. Vite proxies /api and /health to port 8080. Set API_ORIGIN on the Vite process if the API uses a different address.

For HTTPS hosting, expose the frontend through your TLS reverse proxy and set `Cookies__Secure=true`. Use `/health` to check the API. Docker binds the local web port to loopback. For a container-to-container TLS proxy, connect it to the web service over the Compose network.

## Verification

See `tests/README.md` for test commands and the verification scope for this release.

## One catalog on desktop and mobile

Use the **hosted Admin** to make shared changes. **Publish & sync** shows its public store URL. Open that same URL on both devices. The store checks its catalog revision every eight seconds while visible and when returning to the page. Changes to products, stock, categories, slides, translations or themes refresh the open store. A new deployment of the application itself may require a page reload.

For a GitHub Pages customer site, go to **Publish & sync**, enter the publicly reachable HTTPS server origin and approved store slug, then download and publish the **connected** index.html. Configure Pages__Origin on the API as described above. Future catalog edits in that hosted Admin reach both devices without re-exporting. On a hosted HTTPS Admin the dashboard’s GitHub download also generates a connected storefront. Use **Download offline catalog snapshot** in Publish & sync for a static copy. A standalone file Admin and a static snapshot are browser-local demos. For a static site with no API, re-export and republish index.html after editing. The open static storefront checks the published revision on focus and every 30 seconds, and waits until checkout is closed before updating. Offline demo edits are not imported into the hosted store.

To test the server on a trusted Wi-Fi network, set WEB_BIND_ADDRESS=0.0.0.0 in .env, recreate the web service, then open http://YOUR-COMPUTER-LAN-IP:5173/admin on desktop and http://YOUR-COMPUTER-LAN-IP:5173/store/STORE-SLUG on the phone. Use the configured WEB_PORT and allow it through your local firewall for the trusted network. On a phone, localhost refers to the phone. Use HTTPS for internet hosting.

## Merchandising and languages

- Enter comma-separated categories in Product Addition, for example Honey, Gifts, Pantry. Each category is selectable above the catalog and linked in the footer. Price sorting uses the discounted price. Newest and oldest use the product creation sequence, including for products created before this release.
- In Store, set the cover banner and use **Upload banner slides** for up to eight more images. Images rotate every five seconds, with previous, next and pause controls. A configured promotional video plays first, then advances at the end. Reduced-motion preferences disable automatic rotation.
- Footer social links display service icons, their accessible names and a tooltip with the destination URL. Custom platforms use a link icon.
- Admin **Languages** offers the national, regional and de facto official language/script entries in Unicode CLDR 49 territory data, and accepts additional valid BCP 47 language tags. Seven storefront interface translations are supplied: English, Urdu, Hindi, Arabic, French, Spanish and Chinese. Enable languages individually or choose **Enable all listed languages**. Enter translations in Admin or download and import a language JSON file. Set the default and save. Product names, summaries, details, promotions and category names can have merchant-provided translations. Customers choose among enabled languages in the header. Text without a translation falls back to its original wording. Admin and Owner tools are in English.
- Official-language data is derived from Unicode CLDR territoryInfo.json. Selected social logos are from Simple Icons. See licenses/.
