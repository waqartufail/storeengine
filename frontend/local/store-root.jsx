import React from "react";
import { createRoot } from "react-dom/client";
import Store, { Directory } from "../src/Store";
import { currentPath } from "../src/navigation";
import "../src/style.css";
const subscribe = (fn) => {
  window.addEventListener("hashchange", fn);
  window.addEventListener("nw-store-changed", fn);
  return () => {
    window.removeEventListener("hashchange", fn);
    window.removeEventListener("nw-store-changed", fn);
  };
};
function App() {
  React.useSyncExternalStore(
    subscribe,
    () => currentPath() + ":" + window.NW_LOCAL.slug,
  );
  const path = currentPath();

  const match = path.match(/^\/store\/([a-z0-9-]+)(?:\/products\/(\d+))?$/);
  const slug = window.NW_LOCAL.published
    ? window.NW_LOCAL.slug
    : match?.[1] || window.NW_LOCAL.slug;
  const mismatch = window.NW_LOCAL.published && match && match[1] !== slug;
  React.useEffect(() => {
    if (mismatch && window.NW_LOCAL.multiStore) {
      const url = new URL(location.href);
      url.searchParams.set("store", match[1]);
      location.replace(url.href);
    }
  }, [path, slug]);
  if (mismatch)
    return <main className="wrap">Store unavailable at this address.</main>;
  if (path === "/store" && !window.NW_LOCAL.published) return <Directory />;
  return <Store key={slug} slug={slug} productId={match?.[2]} />;
}
createRoot(document.getElementById("root")).render(<App />);
