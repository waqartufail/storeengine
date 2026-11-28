import { snapshot } from "./exportStorefront";
import { validManifest, validSlug, storeManifest } from "./pagesLocation";
const manifestFile = "current.json";
function base64(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > 40 * 1024 * 1024)
    throw Error(
      "Catalog exceeds 40 MiB. Use hosted media URLs and sync again.",
    );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}
export async function publishCatalog(target, token, view, expected) {
  const base =
    "https://api.github.com/repos/" + target.owner + "/" + target.repo;
  async function api(path, options = {}, allowMissing = false) {
    const r = await fetch(base + path, {
      ...options,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      headers: {
        Authorization: "Bearer " + token,
        Accept:
          path.startsWith("/contents/") && !options.body
            ? "application/vnd.github.object+json"
            : "application/vnd.github+json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (allowMissing && r.status === 404) return null;
    if (!r.ok) {
      const detail = await r.json().catch(() => ({}));
      throw Error(
        "GitHub " +
          r.status +
          ". " +
          (detail.message ||
            "Check repository access, branch protection and Contents write permission."),
      );
    }
    return r.json();
  }
  const repo = await api("");
  if (repo.private || !repo.default_branch)
    throw Error("Choose a public repository with a default branch.");
  const branch = repo.default_branch;
  const path = (file) => "/contents/" + target.prefix + "/" + file;
  const get = (file) =>
    api(path(file) + "?ref=" + encodeURIComponent(branch), {}, true);
  const put = (file, body, sha) =>
    api(path(file), {
      method: "PUT",
      body: JSON.stringify({
        branch,
        sha,
        message: "Publish storefront " + file,
        content: base64(body),
      }),
    });
  const slug = view.brand.slug;
  if (!validSlug(slug)) throw Error("Invalid store address.");
  const primary = await get(manifestFile);
  const decode = (file) =>
    file && JSON.parse(atob(file.content.replace(/\s/g, "")));
  const first = decode(primary);
  if (first && !validManifest(first))
    throw Error("Invalid default store publication.");
  const pointer =
    !first || first.slug === slug ? manifestFile : storeManifest(slug);
  const old = pointer === manifestFile ? primary : await get(pointer);
  if (old && (!validManifest(decode(old)) || decode(old).slug !== slug))
    throw Error("Invalid store publication.");
  if ((old?.sha || "") !== expected)
    throw Error(
      "This catalog was published from another session. Load the published catalog before syncing this draft.",
    );
  const file = view.brand.slug + ".json";
  const current = await get(file);
  const catalog = snapshot(view, crypto.randomUUID());
  const uploaded = await put(file, catalog, current?.sha);
  const result = await put(
    pointer,
    { format: 1, slug: view.brand.slug, commit: uploaded.commit.sha },
    old?.sha,
  );
  return result.content.sha;
}
export async function readPublishedDraft(target, slug) {
  const base =
    "https://api.github.com/repos/" +
    target.owner +
    "/" +
    target.repo +
    "/contents/" +
    target.prefix +
    "/";
  if (!validSlug(slug)) throw Error("Invalid store address.");
  let r = await fetch(base + storeManifest(slug), { cache: "no-store" });
  if (r.status === 404)
    r = await fetch(base + manifestFile, { cache: "no-store" });
  if (!r.ok)
    throw Error("Published catalog unavailable (GitHub " + r.status + ").");
  const file = await r.json();
  const manifest = JSON.parse(atob(file.content.replace(/\s/g, "")));
  if (!validManifest(manifest) || manifest.slug !== slug)
    throw Error("This store has no published catalog yet.");
  const data = await fetch(
    base + manifest.slug + ".json?ref=" + manifest.commit,
    {
      headers: { Accept: "application/vnd.github.raw+json" },
      cache: "no-store",
    },
  );
  if (!data.ok) throw Error("Published catalog could not be loaded.");
  const catalog = await data.json();
  if (
    catalog?.brand?.slug !== manifest.slug ||
    !Array.isArray(catalog.products)
  )
    throw Error("Invalid published store.");
  return { sha: file.sha, catalog };
}
