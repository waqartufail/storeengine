import { createWorkspace } from "./database";
const stores = new Map();
export function storeDraft(target, slug) {
  const key = "NaturWala.Draft:" + target.publicUrl + ":" + slug;
  if (!stores.has(key))
    stores.set(
      key,
      createWorkspace(key, () => ({ catalog: null })),
    );
  return stores.get(key);
}
