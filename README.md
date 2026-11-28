# Natur-Wala & Co.

## Direct start

Extract the ZIP into a folder and open the HTML file for your role in Chrome or Edge. Each page runs by double-click. Keep all three in the same directory and use the same browser profile for shared local testing.

| File | Opens |
|---|---|
| store.html | Customer storefront. The sample catalog opens immediately. RUN-LOCAL.html also opens this page. |
| admin.html | Merchant signup and login, product promotions, orders, payments and store settings. |
| owner.html | Platform owner login, registration approvals, plans and deactivation. Keep this file in your private working folder. |

## Stock, ratings, newsletter offers and disclosures

| Where to go | What happens |
|---|---|
| **Admin → Product Addition** | The stock list follows completed checkouts while open. It checks for changes every eight seconds while visible and on return to the tab. Saving an outdated product edit prompts you to review the current quantity. |
| **Store → product detail → Customer ratings** | Choose one to five stars. The page shows average and count. Selecting another star in the same browser updates that vote. Ratings are anonymous and do not require a purchase. |
| **Admin → Product Details** | Select a product, fill **Product disclosures**, then **Save product details**. Line breaks are preserved. Use this field for ingredients, allergens, refurbished condition, excluded accessories or warranty terms. The section appears on that product when populated. |
| **Admin → Promotions → Newsletter welcome discount** | Enable the rule, set the percentage (initially 15) and the minimum product subtotal, then choose **Save newsletter rule**. Set the minimum to zero to allow any eligible bag. **View subscribers** shows addresses and redemption status to this store’s Admin. |
| **Store → Newsletter welcome offer** | The shopper gives email consent and subscribes. An eligible bag applies the discount automatically. The percentage applies to merchandise after product promotions. Shipping is charged separately. Checkout, the receipt and the Admin order all use the same amount. A successful redemption consumes the offer once. A failed checkout leaves it available. |

**Example.** Two products at PKR 1,000 each qualify for a 15% welcome discount of PKR 300. With PKR 200 shipping, the order total is PKR 1,900. An order for two units reduces a stock count of five to three. Repeating the same checkout request returns the original order number.

### Enable Google for newsletter subscribers

1. In Google Cloud, configure Google Auth Platform for the storefront. For a project in testing, add the intended Google test accounts under **Audience**.
2. Under **Clients**, create an OAuth client of type **Web application**. Add the customer storefront to **Authorized JavaScript origins**. For `https://ACCOUNT.github.io/REPO/` enter `https://ACCOUNT.github.io`. Include the port when testing on localhost.
3. Paste the **client ID** ending in `.apps.googleusercontent.com` into **Admin → Promotions → Google web client ID**. The form needs only the public client ID. Choose **Require Google sign-in to claim the offer** if every subscriber must verify their Google email. Otherwise subscribers can enter an email directly or use Google.
4. Save the newsletter rule and open the hosted store. After the shopper checks the newsletter consent box, the Google sign-in button appears. For local HTML file testing use the email option. Google requires a supported web origin. The hosted API verifies the Google credential before issuing an offer.

Email-only signup records the address and consent when entered. Google sign-in verifies the Google account email. The Admin subscriber list records signups and whether offers were redeemed. Sending newsletters requires a mailing service. [Google Identity setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)

### Which checkout does the Admin see?

| Store opened by the shopper | Inventory and customer activity |
|---|---|
| Double-click build, same browser profile | Store and Admin use the same local workspace. Stock and orders appear in that Admin. |
| Unconnected GitHub Pages test build | In the editing browser, checkout for that merchant updates its local Admin inventory. With the Admin open and automatic sync connected, the revised catalog is published. Other shopper browsers keep their own test purchases, ratings and subscriber records. Their test purchases are retained across catalog updates. |
| Hosted ASP.NET store or connected GitHub Pages storefront | Shoppers and the hosted Admin share PostgreSQL. Stock, ratings, orders and offer redemption are shared across devices for that store. For this setup, open the **hosted Admin → Publish & sync → Download connected GitHub storefront** and deploy the exported index.html. See the server deployment instructions below. |

## Publish the customer build for testing on GitHub Pages

1. Extract **Natur-Wala-GitHub-Pages.zip**. Upload **index.html**, **admin.html** and **store.html** together in the publishing folder of your public test repository. Keep the existing folder and filenames when upgrading so the Admin browser can reuse its drafts. The full source package contains these same three files in **github-pages/**.
2. In the repository, open **Settings → Pages → Deploy from a branch**. Select the branch and folder containing the three files. After the initial deployment use **Visit site**. For a project repository the address looks like `https://ACCOUNT.github.io/REPOSITORY/`. For an account site it looks like `https://ACCOUNT.github.io/`.
3. Open **admin.html** at that Pages address and sign in. The supplied sample Admin opens the existing trial workspace in this browser. The **Open store** link includes the signed-in store’s slug (for example, `index.html?store=store-two-2`). Share this complete link. The plain Pages address keeps opening the default storefront. Before first sync the editing browser can preview its own saved catalog. A new device needs a published version. The Owner portal is available in the full package only. Visitors can open the static Admin UI if they know its URL. Authority to publish shared changes comes from GitHub write permission.
4. In **Publish & sync**, the repository and public store address appear automatically on a standard github.io project or account URL. Use GitHub **Settings → Developer settings → Personal access tokens → Fine-grained tokens** to create an expiring token scoped to this repository, with **Contents: Read and write**. Enter it in **GitHub publishing token** and choose **Connect and sync**. Enter it again after reloading or signing out of Admin. Keep it out of commits, screenshots and chats.
5. Leave **Automatically sync after Save** enabled. Save a product or homepage section and wait for **Synced to GitHub**. The storefront fetches the shared catalog on open and checks about every eight seconds while visible. The interval excludes GitHub, media download and network delays. **Sync now** retries a pending publication. Phone shoppers use the same store URL and need no account.
6. On another Admin browser with the same store, first select **Load published catalog into this Admin**. This replaces its local product and branding draft and imports the public shipping and payment settings. It preserves that browser’s private order and courier records. Changes from a competing publisher require a reload of the published catalog before a new sync.

**Publishing details.** The writer uses the repository default branch. It writes a public catalog under `nw-store/<store-slug>.json` and then switches that store’s publication pointer to that exact commit. The first store keeps `nw-store/current.json`. Other stores have separate pointers in `nw-store/stores/<store-slug>/current.json`. The customer reads that commit directly. A partial upload leaves the previous publication active. Multiple approved stores can publish independently to the same repo and Pages directory. On upgrade replace the three HTML files in place and retain the existing nw-store folder. Keep the default branch writable for this test. For a custom domain, use the connected ASP.NET storefront described below or open the app at its standard github.io address if available. The GitHub publisher expects the standard Pages address. The static demo keeps test checkout and inventory reservations in each shopper’s browser. Use the server edition for shared orders, enforceable Owner decisions and live courier processing.

The included customer test store shows a 10% Wildflower Honey offer. At PKR 850 list price, one jar is PKR 765 plus PKR 200 shipping. Successful checkout shows a **Thank you for your order!** screen and the saved **order number**. Refresh keeps that confirmation in the same tab. **Continue shopping** returns to the store with an empty bag.

### Publish your own products and promotions

Open admin.html, sign in and choose **Promotions → Product to promote**. Choose a preset or enter a custom percentage/fixed PKR discount and label. Preview the sale price and choose **Save promotion**. Choose **None** and save to remove it. The original product form supports promotions as well. Discounts appear on the product, in the bag and on the saved order item.

Local file pages share the current browser’s working data. In GitHub Pages Admin, Save publishes catalog changes after connecting GitHub. **Download GitHub storefront** remains available for a single-file catalog export.

### Product photos and detail pages

1. In **Admin → Product Addition**, click a product to edit it. Paste a public HTTPS image address into **Product image URL**, or use **Upload cover photo**. Wait for the preview and save the product. If a website blocks image embedding or the link opens a web page, upload the picture instead.
2. Open **Admin → Product Details**, select the product and enter its full description. You can replace the cover here and add up to **eight additional photos**. Select several PNG, JPEG or WebP files at once, or add gallery URLs individually. Use the arrow buttons to reorder photos, then choose **Save product details**. Individual uploads can be up to 16 MB. The browser resizes larger originals before saving.
3. On the store, click the product name or picture. The product has its own link, photo gallery, full description, price, stock and bag button. Reload the local storefront after editing. For the GitHub Pages edition, check for **Synced to GitHub** after saving. Uploaded photos travel with this export. Linked photos need their original image host to remain accessible.

### Product specifications, bullets and numbered steps

In **Admin → Product Details**, choose the product. Type one feature or instruction on each line, select the lines and click **Bullet list** or **Numbered list**. Press Enter at the end of an item to continue and again on an empty item to finish. The same list button removes the markers from selected items.

Use **Insert table** to enter column headings and values in a grid. For a phone, use **Feature** and **Specification**, then enter rows such as **RAM / 8 GB** and **Storage / 128 GB**. Add or remove rows and columns as needed. **Apply table** places the table into the description draft. **Edit table 1**, **Edit table 2**, etc. reopen existing tables. **Preview description** shows the customer formatting. Choose **Save product details** to persist the changes, then use the existing publishing flow for GitHub Pages. Wide tables scroll within the description on a phone.

### Headings, home-page video and footer links

In **Product Details**, place the cursor on a description line and choose **Heading** or **Subheading**. You can type over the selected text, preview the description and save. Existing plain-text descriptions keep their line breaks.

In **Hero banner**, edit the small heading, both title lines, description and shop button. An empty field hides its text. Upload a cover and additional slides or add an MP4/WebM up to 8 MiB or a direct HTTPS video URL. The full-width background fills the hero and crops to fit on phones. Clips request muted inline autoplay. The shopper has no playback toolbar. The browser controls autoplay permission. Set the slide interval from 2 to 30 seconds. A single video loops; multiple items rotate automatically, including when the pointer is over the banner. The banner image is also the video poster.

**Category showcase** controls the section title and visibility. Its tiles use current product categories and link to matching catalog items. **Featured products** lets the merchant choose products or use the newest four. **Catalog section** controls the catalog headings. Use **Store story** for an optional editorial section and **Footer** for the footer message and linked social icons. Click **Save section** in each tab. **Store** retains the name, browser title and logo. **Languages** includes translation fields for the new section copy.

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

For a Pages test store without a server, use the GitHub publishing steps above. For a Pages customer site connected to PostgreSQL, open the **server Admin → Publish & sync**, enter the deployed ASP.NET origin and approved store slug, download the connected index.html and publish it. Configure Pages__Origin on the API. Make subsequent edits in that server Admin. A github.com repository URL leads to repository files; it cannot serve the ASP.NET endpoints.

To test the server on a trusted Wi-Fi network, set WEB_BIND_ADDRESS=0.0.0.0 in .env, recreate the web service, then open http://YOUR-COMPUTER-LAN-IP:5173/admin on desktop and http://YOUR-COMPUTER-LAN-IP:5173/store/STORE-SLUG on the phone. Use the configured WEB_PORT and allow it through your local firewall for the trusted network. On a phone, localhost refers to the phone. Use HTTPS for internet hosting.

## Design a store without code

Open **Admin → Store designer**. Choose a design area, change its controls and check the live **Desktop** and **Mobile** previews. **Save design** applies the draft to this store. GitHub Pages uses the existing **Publish & sync** connection. On a hosted server the layout is stored with the merchant’s branding in PostgreSQL.

- **Header & logo** changes position, size, shape and the placement of the store name. Upload the logo itself under **Store**.
- **Hero banner** can fill the cover or put the photo and text side by side. **Category showcase**, **Featured products** and **Catalog & filters** each support grid, vertical list and swipeable horizontal layouts.
- Choose filter buttons or a dropdown. Position the filters above the catalog, on its left or on its right. Sidebars move above products on small screens.
- **Footer** independently aligns the store name, message, category links and social icons. Edit footer content in the **Footer** tab.
- Choose **Homepage section order** and use the arrows to move whole sections. **Add custom section** adds a heading, text and optional HTTPS photo with its own alignment and layout. Sections can be hidden or removed from the draft. Use **Languages** to translate their headings and text.
- **Preview default layout** restores the theme’s layout choices in the draft and retains custom content. Save to apply it. Existing stores use their original layout until the merchant saves a change.

## Merchandising and languages

- Enter comma-separated categories in Product Addition, for example Honey, Gifts, Pantry. Each category is selectable above the catalog and linked in the footer. Price sorting uses the discounted price. Newest and oldest use the product creation sequence, including for products created before this release.
- In **Hero banner**, set the cover, video, up to eight additional slides and their interval. Save to publish using your selected deployment mode.
- Footer social links display service icons, their accessible names and a tooltip with the destination URL. Custom platforms use a link icon.
- Admin **Languages** offers the national, regional and de facto official language/script entries in Unicode CLDR 49 territory data, and accepts additional valid BCP 47 language tags. Seven storefront interface translations are supplied: English, Urdu, Hindi, Arabic, French, Spanish and Chinese. Enable languages individually or choose **Enable all listed languages**. Enter translations in Admin or download and import a language JSON file. Set the default and save. Product names, summaries, details, promotions and category names can have merchant-provided translations. Customers choose among enabled languages in the header. Text without a translation falls back to its original wording. Admin and Owner tools are in English.
- Official-language data is derived from Unicode CLDR territoryInfo.json. Selected social logos are from Simple Icons. See licenses/.
