import React, { useEffect, useRef, useState } from "react";
import { Field, Message } from "./ui";

function directUrl(value) {
  const raw = value.trim();
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return "";
    if (
      u.hostname === "github.com" &&
      /^\/[^/]+\/[^/]+\/blob\//.test(u.pathname)
    )
      return (
        "https://raw.githubusercontent.com" + u.pathname.replace("/blob/", "/")
      );
    return u.href;
  } catch {
    return "";
  }
}
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      img.src = "";
      reject(
        Error(
          "The image took too long to load. Upload a copy or try a direct image URL.",
        ),
      );
    }, 20000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(
        Error(
          "This link did not load as an image. Use a public HTTPS image address or upload the photo.",
        ),
      );
    };
    img.src = source;
  });
}
async function uploadedPhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 16 * 1024 * 1024
  )
    throw Error("Choose a PNG, JPEG or WebP photo up to 16 MB.");
  const tmp = URL.createObjectURL(file);
  try {
    const img = await loadImage(tmp);
    // Keep smaller originals intact, and resize larger camera photos for portable store exports.
    if (file.size <= 1024 * 1024)
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(Error("Could not read the image."));
        r.readAsDataURL(file);
      });
    const scale = Math.min(1, 1440 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const out = canvas.toDataURL("image/webp", quality);
      if (out.length <= 1398104) return out;
    }
    throw Error("Please select a smaller photo.");
  } finally {
    URL.revokeObjectURL(tmp);
  }
}
export function CoverPhoto({ value = "", onChange, onBusy }) {
  const [message, say] = useState(""),
    [working, busy] = useState(false);
  const input = useRef(null),
    job = useRef(0);
  useEffect(
    () => () => {
      job.current++;
    },
    [],
  );
  const inline = value.startsWith("data:"),
    src = inline ? value : directUrl(value);
  useEffect(() => {
    let cancelled = false;
    const field = input.current;
    if (!field) return;
    if (!value || inline) {
      field.setCustomValidity("");
      say("");
      return;
    }
    if (!src) {
      field.setCustomValidity("Use a public HTTPS image URL.");
      say("Use a public HTTPS image URL.");
      return;
    }
    field.setCustomValidity("Checking image preview…");
    const timer = setTimeout(
      () =>
        loadImage(src)
          .then(() => {
            if (!cancelled) {
              field.setCustomValidity("");
              say("");
            }
          })
          .catch((e) => {
            if (!cancelled) {
              field.setCustomValidity(e.message);
              say(e.message);
            }
          }),
      150,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [src, value, inline]);
  async function upload(file) {
    if (!file) return;
    const id = ++job.current;
    busy(true);
    onBusy?.(true);
    say("");
    input.current?.setCustomValidity("Reading photo…");
    try {
      const image = await uploadedPhoto(file);
      if (id === job.current) {
        onChange(image);
        input.current?.setCustomValidity("");
      }
    } catch (e) {
      if (id === job.current) {
        say(e.message);
        input.current?.setCustomValidity("");
      }
    } finally {
      if (id === job.current) {
        busy(false);
        onBusy?.(false);
      }
    }
  }
  return (
    <fieldset>
      <legend>Cover photo</legend>
      <label>
        Product image URL (HTTPS)
        <input
          ref={input}
          aria-label="Product image URL (HTTPS)"
          type="url"
          value={inline ? "" : value}
          disabled={working}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(directUrl(raw) || raw);
          }}
          placeholder="Paste a direct image address"
        />
      </label>
      <Field
        label="Upload cover photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          upload(e.target.files[0]);
          e.target.value = "";
        }}
      />
      {src && (
        <img
          className="mediaPreview"
          src={src}
          alt="Cover photo preview"
          referrerPolicy="no-referrer"
        />
      )}
      {value && (
        <button
          type="button"
          className="remove"
          onClick={() => {
            job.current++;
            busy(false);
            onBusy?.(false);
            onChange("");
          }}
        >
          Remove cover photo
        </button>
      )}
      <Message text={working ? "Preparing photo…" : message} />
    </fieldset>
  );
}
export function GalleryEditor({ photos, onChange, onBusy }) {
  const [url, setUrl] = useState(""),
    [message, say] = useState(""),
    [working, busy] = useState(false);
  async function add(produce) {
    busy(true);
    onBusy(true);
    say("");
    try {
      const incoming = await produce();
      const next = [...new Set([...photos, ...incoming])];
      if (next.length > 8)
        throw Error(
          "A product gallery can contain up to eight additional photos.",
        );
      onChange(next);
      setUrl("");
    } catch (e) {
      say(e.message);
    } finally {
      busy(false);
      onBusy(false);
    }
  }
  function move(i, d) {
    const next = [...photos];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  }
  return (
    <fieldset disabled={working}>
      <legend>Gallery photos ({photos.length}/8)</legend>
      <Field
        label="Upload gallery photos"
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          const files = Array.from(e.target.files);
          e.target.value = "";
          if (files.length + photos.length > 8) {
            say("Choose up to eight photos in total.");
            return;
          }
          if (files.length) add(() => Promise.all(files.map(uploadedPhoto)));
        }}
      />
      <Field
        label="Gallery image URL"
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <button
        type="button"
        className="secondary"
        disabled={!url.trim()}
        onClick={() =>
          add(async () => {
            const src = directUrl(url);
            if (!src) throw Error("Enter a public HTTPS image address.");
            await loadImage(src);
            return [src];
          })
        }
      >
        Add URL to gallery
      </button>
      <Message text={working ? "Preparing gallery…" : message} />
      <div className="galleryEdit">
        {photos.map((src, i) => (
          <div key={src}>
            <img
              src={src}
              referrerPolicy="no-referrer"
              alt={"Gallery photo " + (i + 1)}
            />
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={i === 0}
                aria-label={"Move photo " + (i + 1) + " earlier"}
                onClick={() => move(i, -1)}
              >
                ←
              </button>
              <button
                type="button"
                className="secondary"
                disabled={i === photos.length - 1}
                aria-label={"Move photo " + (i + 1) + " later"}
                onClick={() => move(i, 1)}
              >
                →
              </button>
              <button
                type="button"
                className="remove"
                aria-label={"Remove gallery photo " + (i + 1)}
                onClick={() => onChange(photos.filter((_, n) => n !== i))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
