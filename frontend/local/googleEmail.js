// The downloadable test store verifies the provider's signature for its local
// subscription. Connected stores verify credentials again inside ASP.NET.
function bytes(value) {
  return Uint8Array.from(
    atob(value.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
}
export async function googleEmail(token, clientId) {
  const [h, p, s, ...extra] = token.split(".");
  if (!h || !p || !s || extra.length || !clientId || token.length > 8192)
    throw Error("Invalid Google sign-in.");
  const json = (v) => JSON.parse(new TextDecoder().decode(bytes(v)));
  const header = json(h),
    claims = json(p);
  if (
    header.alg !== "RS256" ||
    claims.aud !== clientId ||
    !["accounts.google.com", "https://accounts.google.com"].includes(
      claims.iss,
    ) ||
    claims.email_verified !== true ||
    !claims.email ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= Date.now() / 1000
  )
    throw Error("Google sign-in could not be verified.");
  const r = await fetch("https://www.googleapis.com/oauth2/v3/certs");
  if (!r.ok) throw Error("Google verification unavailable.");
  const key = (await r.json()).keys.find(
    (k) => k.kid === header.kid && k.kty === "RSA",
  );
  if (!key) throw Error("Unknown Google signing key.");
  const pub = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pub,
      bytes(s),
      new TextEncoder().encode(h + "." + p),
    ))
  )
    throw Error("Invalid Google signature.");
  return claims.email;
}
