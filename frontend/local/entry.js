import { request } from "./api";
import { accounts } from "./storage";
import logo from "../public/natur-wala.png";
window.NW_LOCAL = { request, accounts, logo, template: __NW_TEMPLATE__ };
require("./private-root.jsx");
