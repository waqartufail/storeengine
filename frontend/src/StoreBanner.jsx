import pantryCover from "./assets/pantry-cover.webp";
import React, { useEffect, useState } from "react";
import { logo } from "./navigation";
export default function StoreBanner({ brand, t }) {
  const slides = [
    ...new Set(
      [brand.promoVideo, brand.banner, ...(brand.bannerSlides || [])].filter(
        Boolean,
      ),
    ),
  ];
  const [index, change] = useState(0),
    [broken, mark] = useState([]);
  const visible = slides.filter((s) => !broken.includes(s)),
    count = visible.length;
  const pos = count ? index % count : 0,
    src = visible[pos];
  const seconds = Math.min(
    30,
    Math.max(2, Number(brand.homepage?.slideSeconds) || 5),
  );
  useEffect(() => {
    if (count < 2) return;
    const timer = setTimeout(() => change(pos + 1), seconds * 1000);
    return () => clearTimeout(timer);
  }, [pos, count, seconds, src]);
  const fail = () => mark((list) => [...list, src]);
  return (
    <div className="bannerStage">
      {src && src === brand.promoVideo ? (
        <video
          key={src}
          src={src}
          autoPlay
          muted
          playsInline
          loop
          disablePictureInPicture
          disableRemotePlayback
          poster={brand.banner || brand.logo || logo}
          aria-label={brand.name + " promotion"}
          onError={fail}
        />
      ) : src ? (
        <img src={src} onError={fail} alt={brand.name + " store banner"} />
      ) : brand.slug === "natur-wala" ? (
        <img src={pantryCover} alt="" />
      ) : (
        <img className="heroLogo" src={brand.logo || logo} alt={brand.name} />
      )}
      {count > 1 && (
        <div className="bannerControls">
          <button
            type="button"
            aria-label={t("Previous banner")}
            onClick={() => change((pos - 1 + count) % count)}
          >
            ‹
          </button>
          <span>
            {pos + 1} / {count}
          </span>
          <button
            type="button"
            aria-label={t("Next banner")}
            onClick={() => change(pos + 1)}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
