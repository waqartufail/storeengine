// Locate the repository shared by the stores in this Pages directory.
export function pagesLocation(url = new URL(location.href)) {
  const match = /^([a-z0-9-]+)\.github\.io$/i.exec(url.hostname);
  if (!match || url.protocol !== "https:") return null;
  const parts = new URL(".", url).pathname
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);
  const repo = parts.shift() || url.hostname;
  if (
    ![repo, ...parts].every(
      (x) => /^[\w.-]+$/.test(x) && x !== ".." && x !== ".",
    )
  )
    return null;
  const owner = match[1];
  return {
    owner,
    repo,
    prefix: [...parts, "nw-store"].join("/"),
    publicUrl: new URL("index.html", url).href,
  };
}
export function rawUrl(target, ref, file) {
  return (
    "https://raw.githubusercontent.com/" +
    [target.owner, target.repo, ref, target.prefix, file].join("/")
  );
}
export const validManifest = (m) =>
  m?.format === 1 &&
  /^[a-z0-9-]+$/.test(m.slug) &&
  /^[0-9a-f]{40}$/.test(m.commit);

export const validSlug = (slug) =>
  typeof slug === "string" && /^[a-z0-9-]+$/.test(slug);
export function pagesStoreUrl(target, slug) {
  const url = new URL(target.publicUrl);
  url.searchParams.set("store", slug);
  return url.href;
}
export const storeManifest = (slug) => "stores/" + slug + "/current.json";
export const publishKey = (target, slug) =>
  "nw.publish." + target.publicUrl + "." + slug;
