import React from "react";
import paths from "./socialIcons.json";
import { Link2, Linkedin } from "lucide-react";
const domains = {
  "fb.com": "facebook",
  "fb.me": "facebook",
  "x.com": "x",
  "twitter.com": "x",
  "youtu.be": "youtube",
  "wa.me": "whatsapp",
  "bsky.app": "bluesky",
  "t.me": "telegram",
  "discord.gg": "discord",
};
export default function SocialIcon({ item }) {
  let domain;
  try {
    domain = new URL(item.url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  const service =
    domains[domain] ||
    Object.keys({ ...paths, linkedin: true }).find(
      (n) =>
        domain === n + ".com" ||
        domain.endsWith("." + n + ".com") ||
        domain === n + ".org" ||
        domain === n + ".net" ||
        domain === n + ".tv",
    ) ||
    item.label.trim().toLowerCase();
  const path = paths[service];
  return (
    <a
      className="socialIcon"
      href={item.url}
      title={item.url}
      aria-label={item.label}
      target="_blank"
      rel="noopener noreferrer"
    >
      {path ? (
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <path d={path} />
        </svg>
      ) : service === "linkedin" ? (
        <Linkedin aria-hidden="true" />
      ) : (
        <Link2 aria-hidden="true" style={{ fill: "none" }} />
      )}
    </a>
  );
}
