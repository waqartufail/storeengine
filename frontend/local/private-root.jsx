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
  React.useSyncExternalStore(subscribe, currentPath);
  return (
    <AccountPortal
      role={__NW_ROLE__}
      Dashboard={__NW_ROLE__ === "owner" ? Owner : Admin}
    />
  );
}
createRoot(document.getElementById("root")).render(<App />);
