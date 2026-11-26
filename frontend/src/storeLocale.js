import messages from "./storeMessages.json";
export const messagesEn = messages.en;
export const bundled = Object.keys(messages);
export const defaults = {
  default: "en",
  packs: Object.fromEntries(bundled.map((code) => [code, {}])),
};
const keys = new Map(messages.en.map((key, i) => [key, i]));
export function localeName(code, display = code) {
  try {
    return (
      new Intl.DisplayNames([display], { type: "language" }).of(code) || code
    );
  } catch {
    return code;
  }
}
export function direction(code) {
  try {
    const l = new Intl.Locale(code);
    return (
      l.getTextInfo?.().direction ||
      l.textInfo?.direction ||
      (["Arab", "Hebr", "Thaa", "Nkoo", "Adlm", "Rohg", "Syrc"].includes(
        l.maximize().script,
      )
        ? "rtl"
        : "ltr")
    );
  } catch {
    return "ltr";
  }
}
export function translator(code, cfg) {
  const custom = cfg.packs[code] || {};
  const base = messages[code] || messages[code.split("-")[0]] || messages.en;
  return (key, original = key) =>
    (Object.hasOwn(custom, key) && custom[key]) ||
    base[keys.get(key)] ||
    original;
}
