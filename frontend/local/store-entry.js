import logo from "../public/natur-wala.png";
import { transaction } from "./storage";
import { publicRequest } from "./commerce";
window.NW_LOCAL = {
  request: publicRequest(transaction),
  logo,
  slug: "natur-wala",
  scope: new URL("RUN-LOCAL.html", location.href).pathname,
};
require("./store-root.jsx");
