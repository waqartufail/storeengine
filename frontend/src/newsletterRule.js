export const defaultOffer = {
  enabled: false,
  percent: 15,
  minimum: 0,
  googleClientId: "",
  googleOnly: false,
};
export function validOffer(r) {
  return (
    !!r &&
    Number.isInteger(r.percent) &&
    r.percent >= 1 &&
    r.percent <= 100 &&
    Number.isFinite(r.minimum) &&
    r.minimum >= 0 &&
    r.minimum <= 10000000 &&
    Number(r.minimum.toFixed(2)) === r.minimum &&
    (!r.googleClientId ||
      /^[\w-]+\.apps\.googleusercontent\.com$/.test(r.googleClientId)) &&
    (!r.googleOnly || !!r.googleClientId)
  );
}
