import React, { useEffect, useRef, useState } from "react";
import { api, Field } from "./ui";
import { pagesLocation, pagesStoreUrl, publishKey } from "./pagesLocation";
import { publishCatalog, readPublishedDraft } from "./githubPublish";

export function useGitHubSync(slug) {
  const target = pagesLocation();
  const key = target ? publishKey(target, slug) : "nw.publish.offline." + slug;
  const token = useRef(""),
    running = useRef(false),
    queued = useRef(false),
    mounted = useRef(true);
  const [connected, connect] = useState(false),
    [busy, working] = useState(false);
  const [status, message] = useState(() =>
    localStorage.getItem(key + ".dirty")
      ? "Saved in this browser. Sync pending."
      : "",
  );
  const [auto, setAuto] = useState(
    () => localStorage.getItem(key + ".auto") !== "off",
  );
  async function sync() {
    if (!target || !token.current) {
      message("Saved in this browser. Connect GitHub in Publish & sync.");
      return;
    }
    queued.current = true;
    if (running.current) return;
    running.current = true;
    working(true);
    try {
      while (queued.current && mounted.current) {
        queued.current = false;
        message("Publishing catalog to GitHub…");
        const view = await api("/stores/" + slug);
        const sha = await publishCatalog(
          target,
          token.current,
          view,
          localStorage.getItem(key + ".sha") || "",
        );
        localStorage.setItem(key + ".sha", sha);
      }
      localStorage.removeItem(key + ".dirty");
      if (mounted.current)
        message("Synced to GitHub at " + new Date().toLocaleTimeString() + ".");
    } catch (e) {
      if (mounted.current) message("Sync pending. " + e.message);
    } finally {
      running.current = false;
      if (mounted.current) working(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      token.current = "";
      queued.current = false;
    };
  }, []);
  useEffect(() => {
    if (!target) return;
    const changed = () => {
      localStorage.setItem(key + ".dirty", "1");
      if (auto && token.current) void sync();
      else message("Saved in this browser. Sync pending.");
    };
    window.addEventListener("nw-catalog-saved", changed);
    const sale = (e) => {
      if (e.key === key + ".checkout") changed();
    };
    window.addEventListener("storage", sale);
    return () => {
      window.removeEventListener("storage", sale);
      window.removeEventListener("nw-catalog-saved", changed);
    };
  }, [key, auto]);
  async function pull() {
    if (
      running.current ||
      !window.confirm(
        "Replace this browser’s product and storefront drafts with the published catalog?",
      )
    )
      return;
    running.current = true;
    working(true);
    try {
      const { sha, catalog } = await readPublishedDraft(target, slug);
      await api("/admin/import-public", "PUT", catalog);
      localStorage.setItem(key + ".sha", sha);
      localStorage.removeItem(key + ".dirty");
      location.reload();
    } catch (e) {
      message(e.message);
    } finally {
      running.current = false;
      working(false);
    }
  }
  return {
    target,
    storeUrl: target && pagesStoreUrl(target, slug),
    busy,
    connected,
    auto,
    status,
    sync,
    pull,
    authorize(value) {
      token.current = value.trim();
      connect(Boolean(token.current));
    },
    toggle(value) {
      setAuto(value);
      localStorage.setItem(key + ".auto", value ? "on" : "off");
    },
  };
}
export function GitHubSync({ model: m }) {
  const [key, setKey] = useState("");
  return (
    <section className="panel form">
      <h2>GitHub Pages publishing</h2>
      <p>
        Store address:{" "}
        <a href={m.storeUrl} target="_blank" rel="noreferrer">
          {m.storeUrl}
        </a>
      </p>
      <p>
        Use a fine-grained GitHub token for{" "}
        <b>
          {m.target.owner}/{m.target.repo}
        </b>{" "}
        with Contents read and write access. It stays in memory until this Admin
        page closes or you sign out.
      </p>
      {!m.connected ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            m.authorize(key);
            setKey("");
            void m.sync();
          }}
        >
          <Field
            label="GitHub publishing token"
            type="password"
            autoComplete="off"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <button className="cta" disabled={m.busy}>
            Connect and sync
          </button>
        </form>
      ) : (
        <button
          className="secondary"
          disabled={m.busy}
          onClick={() => m.authorize("")}
        >
          Disconnect GitHub
        </button>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={m.auto}
          onChange={(e) => m.toggle(e.target.checked)}
        />
        Automatically sync after Save
      </label>
      <div className="actions">
        <button
          className="cta"
          disabled={m.busy || !m.connected}
          onClick={m.sync}
        >
          Sync now
        </button>
        <button className="secondary" disabled={m.busy} onClick={m.pull}>
          Load published catalog into this Admin
        </button>
      </div>
      <p className="muted">
        On a second Admin browser, load the published catalog before editing.
        The storefront checks for changes on open and about every eight seconds
        while visible. Orders in this Pages edition are test orders on the
        shopper’s device.
      </p>
    </section>
  );
}
