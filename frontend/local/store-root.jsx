import React from "react";
import { createRoot } from "react-dom/client";
import Store, { Directory } from "../src/Store";
import { currentPath } from "../src/navigation";
import "../src/style.css";
const subscribe = (fn) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
function App() {
  const path = React.useSyncExternalStore(subscribe, currentPath);
  if (path === "/store" && !window.NW_LOCAL.published) return <Directory />;
  const match = path.match(/^\/store\/([a-z0-9-]+)(?:\/products\/(\d+))?$/);
  const slug = window.NW_LOCAL.published
    ? window.NW_LOCAL.slug
    : match?.[1] || window.NW_LOCAL.slug;
  return <Store key={slug} slug={slug} productId={match?.[2]} />;
}
createRoot(document.getElementById("root")).render(<App />);
