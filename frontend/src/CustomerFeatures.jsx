import { freshId } from "./freshId";
import React, { useEffect, useRef, useState } from "react";
import { api, Message, useAction } from "./ui";
let googleLoad;
function googleIdentity() {
  if (window.google?.accounts?.id)
    return Promise.resolve(window.google.accounts.id);
  if (!googleLoad)
    googleLoad = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.onload = () =>
        window.google?.accounts?.id
          ? resolve(window.google.accounts.id)
          : reject(Error("Google sign-in unavailable."));
      script.onerror = () => {
        script.remove();
        googleLoad = null;
        reject(Error("Could not load Google sign-in."));
      };
      document.head.appendChild(script);
    });
  return googleLoad;
}
export function NewsletterSignup({ slug, rule, offer, claim, t }) {
  const [consent, setConsent] = useState(false),
    [email, setEmail] = useState("");
  const box = useRef(null),
    a = useAction(),
    handler = useRef(null);
  const google =
    !!rule?.googleClientId &&
    ["https:", "http:"].includes(location.protocol) &&
    !window.NW_LOCAL?.preview;
  async function join(credential) {
    if (!consent) return;
    await a.run(async () => {
      const r = await api("/stores/" + slug + "/newsletter", "POST", {
        consent: true,
        email: credential ? null : email,
        credential,
      });
      claim(r.code);
      a.setMessage(t("Your welcome discount is ready."));
    });
  }
  handler.current = join;
  useEffect(() => {
    if (!consent || !google || !box.current || offer) return;
    let live = true;
    googleIdentity()
      .then((id) => {
        if (!live || !box.current) return;
        id.initialize({
          client_id: rule.googleClientId,
          callback: (r) => {
            if (live) handler.current(r.credential);
          },
        });
        id.renderButton(box.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "signin_with",
        });
      })
      .catch((e) => {
        if (live) a.setMessage(e.message);
      });
    return () => {
      live = false;
    };
  }, [consent, google, rule?.googleClientId, offer]);
  if (!rule?.enabled || window.NW_LOCAL?.preview) return null;
  return (
    <section className="wrap welcomeOffer">
      <h2>{t("Newsletter welcome offer")}</h2>
      <p>
        {t("Subscribe for a one-time discount on products")}:{" "}
        <strong>{rule.percent}%</strong>
        {rule.minimum > 0 &&
          " · " + t("Minimum subtotal") + " PKR " + rule.minimum}
        .
      </p>
      {offer ? (
        <p>{t("Your discount will apply automatically to an eligible bag.")}</p>
      ) : (
        <>
          <label className="check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            {t("I agree to receive this store’s newsletter by email.")}
          </label>
          {!rule.googleOnly && (
            <form
              className="actions"
              onSubmit={(e) => {
                e.preventDefault();
                join(null);
              }}
            >
              <label>
                {t("Newsletter email")}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button className="cta" disabled={!consent || a.busy}>
                {t("Get welcome discount")}
              </button>
            </form>
          )}
          {google && consent && <div ref={box} />}
          {rule.googleOnly && !google && (
            <p>{t("Open the hosted store to use Google sign-in.")}</p>
          )}
        </>
      )}
      <Message text={a.message} />
    </section>
  );
}
export function ProductRating({ slug, id, t }) {
  const path = "/stores/" + slug + "/products/" + id + "/rating";
  const key =
    "nw.stars." + location.pathname.replace(/[^/]*$/, "") + slug + "." + id;
  const [stats, update] = useState(null),
    [picked, choose] = useState(0),
    a = useAction();
  useEffect(() => {
    let live = true;
    update(null);
    try {
      choose(Number(localStorage.getItem(key + ".value")) || 0);
    } catch {}
    if (!window.NW_LOCAL?.preview)
      api(path)
        .then((s) => {
          if (live) update(s);
        })
        .catch((e) => {
          if (live) a.setMessage(e.message);
        });
    return () => {
      live = false;
    };
  }, [path]);
  async function rate(n) {
    await a.run(async () => {
      let voter = localStorage.getItem(key + ".id");
      if (!voter) {
        voter = freshId();
        localStorage.setItem(key + ".id", voter);
      }
      const s = await api(path, "POST", { stars: n, voter });
      update(s);
      choose(n);
      localStorage.setItem(key + ".value", n);
      a.setMessage(t("Your rating was saved."));
    });
  }
  return (
    <section className="productRating">
      <h3>{t("Customer ratings")}</h3>
      {stats?.count > 0 && (
        <span className="summaryStars" aria-hidden="true">
          ☆☆☆☆☆
          <span style={{ width: (stats.average / 5) * 100 + "%" }}>★★★★★</span>
        </span>
      )}
      {stats && (
        <p>
          {stats.count
            ? stats.average.toFixed(1) +
              " / 5 · " +
              stats.count +
              " " +
              t(stats.count === 1 ? "rating" : "ratings")
            : t("No ratings yet")}
        </p>
      )}
      <div
        aria-label={t("Rate this product")}
        role="group"
        className="ratingStars"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            aria-label={n + " " + t(n === 1 ? "star" : "stars")}
            aria-pressed={picked === n}
            disabled={a.busy}
            onClick={() => rate(n)}
          >
            {n <= picked ? "★" : "☆"}
          </button>
        ))}
      </div>
      <Message text={a.message} />
    </section>
  );
}
