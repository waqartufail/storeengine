import React from "react";
import { createRoot } from "react-dom/client";
import { Admin, AccountPortal } from "../src/Management";
import { Owner } from "../src/Accounts";
import { currentPath } from "../src/navigation";
import "../src/style.css";
const subscribe = (fn) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
function App() {
  const path = React.useSyncExternalStore(subscribe, currentPath);
  const key =
    __NW_ROLE__ === "admin" && /^\/admin\/orders\/\d+$/.test(path)
      ? path
      : __NW_ROLE__;
  return (
    <AccountPortal
      key={key}
      role={__NW_ROLE__}
      Dashboard={__NW_ROLE__ === "owner" ? Owner : Admin}
    />
  );
}
createRoot(document.getElementById("root")).render(<App />);
