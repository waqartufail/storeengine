import React from "react";
import { createRoot } from "react-dom/client";
import { currentPath } from "./navigation";
import { Owner } from "./Accounts";
import { Admin, AccountPortal } from "./Management";
import Store, { Directory } from "./Store";
import "./style.css";
function App() {
  const path = currentPath();
  if (path === "/owner" || path === "/owner.html")
    return <AccountPortal role="owner" Dashboard={Owner} />;
  if (
    path === "/admin" ||
    path === "/admin.html" ||
    /^\/admin\/orders\/\d+$/.test(path)
  )
    return <AccountPortal role="admin" Dashboard={Admin} />;
  const shop = path.match(/^\/store\/([a-z0-9-]+)(?:\/products\/(\d+))?$/);
  if (shop) return <Store slug={shop[1]} productId={shop[2]} />;
  return <Directory />;
}
createRoot(document.getElementById("root")).render(<App />);
