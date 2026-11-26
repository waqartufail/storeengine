// A static Pages store can follow a newly published export. Never interrupt an order form.
export function watchPublishedCatalog(revision) {
  if (!["http:", "https:"].includes(location.protocol)) return;
  const source = new URL("index.html", location.href);
  let checking = false,
    etag = "",
    modified = "",
    nextRevision = "";
  const safeToReload = () =>
    !document.hidden &&
    !document.querySelector('[role="dialog"],.thankYou') &&
    !new URL(location.href).searchParams.has("order");
  async function check() {
    if (checking || !safeToReload()) return;
    checking = true;
    try {
      if (!nextRevision) {
        const headers = etag
          ? { "If-None-Match": etag }
          : modified
            ? { "If-Modified-Since": modified }
            : {};
        const response = await fetch(source, { cache: "no-cache", headers });
        if (response.status === 304 || !response.ok) return;
        etag = response.headers.get("etag") || "";
        modified = response.headers.get("last-modified") || "";
        const text = await response.text();
        const marker = '<script type="application/json" id="catalog-data">';
        const start = text.indexOf(marker),
          end = text.indexOf("</script>", start + marker.length);
        if (start < 0 || end < 0) return;
        const published = JSON.parse(
          text.slice(start + marker.length, end),
        ).revision;
        if (published && published !== revision) nextRevision = published;
      }
      if (nextRevision && safeToReload()) {
        const url = new URL(location.href);
        if (url.searchParams.get("v") !== nextRevision) {
          url.searchParams.set("v", nextRevision);
          location.replace(url.href);
        }
      }
    } catch {
      /* A disconnected snapshot remains available. */
    } finally {
      checking = false;
    }
  }
  window.addEventListener("focus", check);
  document.addEventListener("visibilitychange", check);
  setInterval(check, 30000);
  check();
}
