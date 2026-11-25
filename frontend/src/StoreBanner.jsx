import React, { useState } from "react";
import { logo } from "./navigation";
export default function StoreBanner({ brand }) {
  const [failed, setFailed] = useState("");
  const video = brand.promoVideo;
  if (video && failed !== video)
    return (
      <video
        key={video}
        src={video}
        controls
        muted
        loop
        playsInline
        autoPlay={
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        }
        preload="metadata"
        poster={brand.banner || brand.logo || logo}
        aria-label={brand.name + " promotion"}
        onError={() => setFailed(video)}
      />
    );
  return brand.banner ? (
    <img src={brand.banner} alt={brand.name + " store banner"} />
  ) : (
    <img className="heroLogo" src={brand.logo || logo} alt={brand.name} />
  );
}
