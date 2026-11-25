import { link, logo, local } from "./navigation";
import React, { useEffect, useState } from "react";
import { themes } from "./themes";

export const money = (n) =>
  "PKR " + Number(n).toLocaleString("en-PK", { maximumFractionDigits: 2 });
export const statuses = [
  "Pending",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
  "Cancelled",
];
export async function api(path, method = "GET", body) {
  if (local) {
    try {
      return await window.NW_LOCAL.request(path, method, body);
    } catch (e) {
      if ([401, 403].includes(e.status) && !path.startsWith("/auth/"))
        window.dispatchEvent(
          new CustomEvent("access-lost", { detail: e.message }),
        );
      throw e;
    }
  }
  const res = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "X-NW-Request": "portal",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.text();
  let result;
  try {
    result = data ? JSON.parse(data) : null;
  } catch {
    result = null;
  }
  if (!res.ok) {
    const err = new Error(
      result?.message ||
        {
          401: "Please sign in with your email and password.",
          403: "Access denied.",
          404: "Record unavailable.",
          429: "Too many attempts. Try again in five minutes.",
        }[res.status] ||
        "The request failed. Please try again.",
    );
    err.status = res.status;
    if ([401, 403].includes(res.status) && !path.startsWith("/auth/"))
      window.dispatchEvent(
        new CustomEvent("access-lost", { detail: err.message }),
      );
    throw err;
  }
  return result;
}
export function useAction() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const lock = React.useRef(false);
  async function run(fn) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { message, setMessage, busy, run };
}
export function useTheme(brand) {
  useEffect(() => {
    const t =
      themes.find((t) => t.id === brand?.theme) ||
      themes.find((t) => t.id === "royal");
    for (const [key, value] of Object.entries(t.vars))
      document.documentElement.style.setProperty("--" + key, value);
    document.title = brand?.browserTitle || "Natur-Wala & Co.";
  }, [brand?.theme, brand?.browserTitle]);
}
export function Header({ brand, children }) {
  return (
    <header className="top">
      <div className="brand">
        <img className="logo" src={brand?.logo || logo} alt="" />
        <span>{brand?.name || "Natur-Wala & Co."}</span>
      </div>
      <nav className="nav">{children}</nav>
    </header>
  );
}
export function Field({ label, ...props }) {
  return (
    <label>
      {label}
      <input aria-label={label} {...props} />
    </label>
  );
}
export function Select({ label, values, ...props }) {
  return (
    <label>
      {label}
      <select aria-label={label} {...props}>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );
}
export function ImageField({ label, value, onChange, error }) {
  async function load(file) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      error("Choose a PNG, JPG or WebP image up to 1 MiB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result);
    reader.onerror = () => error("Image could not be read.");
    reader.readAsDataURL(file);
  }
  return (
    <div className="imageField">
      <Field
        label={label}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => load(e.target.files[0])}
      />
      {value && (
        <div>
          <img src={value} alt={label + " preview"} />
          <button type="button" className="remove" onClick={() => onChange("")}>
            Remove image
          </button>
        </div>
      )}
    </div>
  );
}
export function Message({ text }) {
  return text ? (
    <p className="feedback" role="status">
      {text}
    </p>
  ) : null;
}
export function exportJson(name, data) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function dayLocal(iso) {
  const d = new Date(iso);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}
