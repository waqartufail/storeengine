import React, { useEffect, useState } from "react";
import { logo } from "./navigation";
export default function StoreBanner({ brand, t = (x) => x }) {
  const slides = [
    ...new Set(
      [brand.promoVideo, brand.banner, ...(brand.bannerSlides || [])].filter(
        Boolean,
      ),
    ),
  ];
  const [index, change] = useState(0),
    [broken, mark] = useState([]),
    [paused, pause] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [hover, setHover] = useState(false),
    [focus, setFocus] = useState(false);
  const visible = slides.filter((src) => !broken.includes(src)),
    count = visible.length,
    pos = count ? index % count : 0,
    src = visible[pos],
    video = src && src === brand.promoVideo;
  const move = (d) => change((pos + d + count) % count);
  useEffect(() => {
    if (count < 2 || paused || video || hover || focus) return;
    const timer = setTimeout(() => change((pos + 1) % count), 5000);
    return () => clearTimeout(timer);
  }, [pos, count, paused, video, hover, focus, src]);
  const fallback = () => mark((old) => [...old, src]);
  return (
    <div
      className="bannerStage"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
      }}
    >
      {video ? (
        <video
          key={src}
          src={src}
          controls
          muted
          playsInline
          loop={count === 1}
          autoPlay={!paused}
          onEnded={() => {
            if (!paused && count > 1) move(1);
          }}
          poster={brand.banner || brand.logo || logo}
          aria-label={brand.name + " promotion"}
          onError={fallback}
        />
      ) : src ? (
        <img src={src} alt={brand.name + " store banner"} onError={fallback} />
      ) : (
        <img className="heroLogo" src={brand.logo || logo} alt={brand.name} />
      )}
      {count > 1 && (
        <div className="bannerControls">
          <button
            type="button"
            aria-label={t("Previous banner")}
            onClick={() => move(-1)}
          >
            ‹
          </button>
          <span>
            {pos + 1} / {count}
          </span>
          <button
            type="button"
            aria-label={t("Next banner")}
            onClick={() => move(1)}
          >
            ›
          </button>
          <button
            type="button"
            aria-label={t(paused ? "Play slideshow" : "Pause slideshow")}
            onClick={() => pause(!paused)}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
        </div>
      )}
    </div>
  );
}
