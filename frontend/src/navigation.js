export const local = Boolean(window.NW_LOCAL);
export const logo = window.NW_LOCAL?.logo || "/natur-wala.png";
export function link(path) {
  if (!local) return path;
  if (path.startsWith("/admin")) return "admin.html#" + path;
  return (window.NW_LOCAL.published ? "index.html" : "store.html") + "#" + path;
}
export function currentPath() {
  return (
    local ? location.hash.slice(1).split("#")[0] : location.pathname
  ).replace(/\/+$/, "");
}
export const currentTab = () =>
  local ? location.hash.split("#")[2] : location.hash.slice(1);
export const setTabLocation = (tab) => {
  location.hash = local ? "/admin#" + tab : tab;
};
export function scrollToCatalog(e) {
  if (local) {
    e.preventDefault();
    document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth" });
  }
}
