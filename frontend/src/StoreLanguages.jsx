import React, { useEffect, useState } from "react";
import { api, Field, Message, exportJson } from "./ui";
import {
  defaults,
  bundled,
  messagesEn,
  translator,
  localeName,
  direction,
} from "./storeLocale";
import codes from "./officialLanguages.json";
import { storeCategories } from "./categories";
const officialChoices = codes
  .map((code) => ({ code, name: localeName(code, "en") }))
  .sort((a, b) => a.name.localeCompare(b.name));
export default function StoreLanguages({ brand, save, busy }) {
  const [cfg, set] = useState(() => brand.languages || defaults),
    [code, choose] = useState(brand.languages?.default || "ur"),
    [candidate, enter] = useState(""),
    [notice, say] = useState(""),
    [products, load] = useState([]),
    [key, select] = useState("Shop");
  const names = Object.keys(cfg.packs);
  const dict = cfg.packs[code] || {};
  useEffect(() => {
    api("/admin/products")
      .then(load)
      .catch((e) => say(e.message));
  }, []);
  const texts = new Map(messagesEn.map((k) => [k, k]));
  for (const c of storeCategories(products))
    texts.set("category:" + c.toLowerCase(), c);
  for (const p of products)
    for (const k of ["name", "description", "details", "promoLabel"])
      if (p[k]) texts.set("p:" + p.id + ":" + k, p[k]);
  function add() {
    let canonical;
    try {
      canonical = Intl.getCanonicalLocales(candidate.trim())[0];
      if (!canonical) throw Error();
    } catch {
      say("Choose a language or enter a valid language tag.");
      return;
    }
    set({
      ...cfg,
      packs: { ...cfg.packs, [canonical]: cfg.packs[canonical] || {} },
    });
    choose(canonical);
    enter("");
    say("");
  }
  async function importPack(file) {
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw Error("Use a language file smaller than 5 MiB.");
      const pack = JSON.parse(await file.text());
      if (
        pack.language !== code ||
        !pack.translations ||
        Array.isArray(pack.translations) ||
        typeof pack.translations !== "object"
      )
        throw Error("Choose a translation file for the selected language.");
      if (
        Object.entries(pack.translations).some(
          ([k, v]) =>
            !texts.has(k) || typeof v !== "string" || v.length > 16000,
        )
      )
        throw Error("This file contains unknown text keys or invalid values.");
      set((cfg) => ({
        ...cfg,
        packs: {
          ...cfg.packs,
          [code]: { ...cfg.packs[code], ...pack.translations },
        },
      }));
      say("Translations imported. Save storefront languages to publish them.");
    } catch (e) {
      say(e.message);
    }
  }
  return (
    <section className="panel form languageFields">
      <h2>Storefront languages</h2>
      <p>
        Choose the languages your customers see. Built-in translations cover{" "}
        {bundled.map((c) => localeName(c, "en")).join(", ")}. Add translations
        for your products and other languages below. Missing text uses the
        original wording.
      </p>
      <label>
        Available languages
        <select value={candidate} onChange={(e) => enter(e.target.value)}>
          <option value="">Choose language</option>
          {officialChoices.map(({ code, name }) => (
            <option key={code} value={code}>
              {name} · {code}
            </option>
          ))}
          {candidate && !codes.includes(candidate) && (
            <option value={candidate}>{candidate}</option>
          )}
        </select>
      </label>
      <Field
        label="Language tag"
        value={candidate}
        placeholder="e.g. pa-Arab"
        onChange={(e) => enter(e.target.value)}
      />
      <button type="button" className="secondary" onClick={add}>
        Enable language
      </button>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          set({
            ...cfg,
            packs: {
              ...Object.fromEntries(codes.map((c) => [c, {}])),
              ...cfg.packs,
            },
          });
          say(
            "Listed languages enabled. Add translations and save to publish.",
          );
        }}
      >
        Enable all listed languages
      </button>
      <label>
        Default storefront language
        <select
          value={cfg.default}
          onChange={(e) => set({ ...cfg, default: e.target.value })}
        >
          {names.map((c) => (
            <option key={c} value={c}>
              {localeName(c, "en")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Edit language
        <select value={code} onChange={(e) => choose(e.target.value)}>
          {names.map((c) => (
            <option key={c} value={c}>
              {localeName(c, "en")}
            </option>
          ))}
        </select>
      </label>
      <label>
        Text to translate
        <select value={key} onChange={(e) => select(e.target.value)}>
          {[...texts].map(([id, original]) => (
            <option key={id} value={id}>
              {id.startsWith("p:") ? id + " · " : ""}
              {original.slice(0, 90)}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{texts.get(key)}</p>
      <label>
        Translation
        <textarea
          dir={direction(code)}
          lang={code}
          rows={3}
          maxLength={16000}
          value={dict[key] || ""}
          placeholder={translator(code, cfg)(key, texts.get(key))}
          onChange={(e) => {
            const values = { ...dict, [key]: e.target.value };
            if (!e.target.value) delete values[key];
            set({ ...cfg, packs: { ...cfg.packs, [code]: values } });
          }}
        />
      </label>
      <details>
        <summary>Import or export translations</summary>
        <p>
          Download this store’s text, translate the values and import the JSON
          file for the same language.
        </p>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            exportJson(brand.slug + "-" + code + ".json", {
              language: code,
              translations: Object.fromEntries(
                [...texts].map(([k, v]) => [k, translator(code, cfg)(k, v)]),
              ),
            })
          }
        >
          Download language file
        </button>
        <Field
          label="Import language file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            importPack(e.target.files[0]);
            e.target.value = "";
          }}
        />
      </details>
      {code !== "en" && (
        <button
          type="button"
          className="remove"
          onClick={() => {
            const packs = { ...cfg.packs };
            delete packs[code];
            choose("en");
            set({ default: cfg.default === code ? "en" : cfg.default, packs });
          }}
        >
          Disable selected language
        </button>
      )}
      <button className="cta" disabled={busy} onClick={() => save(cfg)}>
        Save storefront languages
      </button>
      <Message text={notice} />
    </section>
  );
}
