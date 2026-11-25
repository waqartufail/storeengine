import React, { useState } from "react";
import { Field } from "./ui";

export default function StoreBrandFields({ brand, patch, onBusy }) {
  const [message, say] = useState(""),
    [busy, working] = useState(false);
  const video = brand.promoVideo || "",
    links = brand.socialLinks || [];
  async function upload(file) {
    if (!file) return;
    working(true);
    onBusy(true);
    say("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw Error("Choose a video up to 8 MiB, or paste a hosted video URL.");
      const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      const mp4 = String.fromCharCode(...head.slice(4, 8)) === "ftyp";
      const webm = [0x1a, 0x45, 0xdf, 0xa3].every((v, i) => head[i] === v);
      if (!mp4 && !webm) throw Error("Choose an MP4 or WebM video.");
      const value = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error("Could not read this video."));
        r.readAsDataURL(
          file.slice(0, file.size, mp4 ? "video/mp4" : "video/webm"),
        );
      });
      patch("promoVideo", value);
    } catch (e) {
      say(e.message);
    } finally {
      working(false);
      onBusy(false);
    }
  }
  function row(index, key, value) {
    patch(
      "socialLinks",
      links.map((x, i) => (i === index ? { ...x, [key]: value } : x)),
    );
  }
  return (
    <>
      <fieldset disabled={busy}>
        <legend>Promotional banner video</legend>
        <p className="muted">
          Upload an MP4 or WebM up to 8 MiB, or paste a direct HTTPS video URL.
          Your banner image is the poster.
        </p>
        <Field
          label="Banner video URL"
          type="url"
          pattern="https://.+"
          maxLength={8192}
          placeholder="https://…"
          value={video.startsWith("data:") ? "" : video}
          onChange={(e) => {
            say("");
            patch("promoVideo", e.target.value.trim());
          }}
        />
        <Field
          label="Upload banner video"
          type="file"
          accept="video/mp4,video/webm,.mp4,.webm"
          onChange={(e) => {
            upload(e.target.files[0]);
            e.target.value = "";
          }}
        />
        {video && (
          <>
            <video
              className="promoPreview"
              aria-label="Banner video preview"
              controls
              playsInline
              preload="metadata"
              src={video}
              onError={() =>
                say(
                  "Preview unavailable. Check the video link or upload a playable file.",
                )
              }
              onLoadedMetadata={() => say("")}
            />
            <button
              className="remove"
              type="button"
              onClick={() => {
                patch("promoVideo", "");
                say("");
              }}
            >
              Remove video
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </fieldset>
      <fieldset>
        <legend>Footer social links</legend>
        {links.map((x, i) => (
          <div className="socialEdit" key={i}>
            <Field
              label={"Platform name " + (i + 1)}
              placeholder="Instagram"
              required
              maxLength={48}
              value={x.label}
              onChange={(e) => row(i, "label", e.target.value)}
            />
            <Field
              label={"Profile URL " + (i + 1)}
              type="url"
              pattern="https://.+"
              required
              maxLength={2048}
              value={x.url}
              onChange={(e) => row(i, "url", e.target.value.trim())}
            />
            <button
              className="remove"
              type="button"
              aria-label={"Remove social link " + (i + 1)}
              onClick={() =>
                patch(
                  "socialLinks",
                  links.filter((_, j) => i !== j),
                )
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          className="secondary"
          type="button"
          disabled={links.length >= 12}
          onClick={() =>
            patch("socialLinks", [...links, { label: "", url: "" }])
          }
        >
          Add social link
        </button>
      </fieldset>
    </>
  );
}
