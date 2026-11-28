import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, Message } from "./ui";
import { designGroups, readDesign, sectionNames } from "./storeDesign";
import { fillTemplate, snapshot, storefrontTemplate } from "./exportStorefront";

function Preview({ slug, brand, design, group }) {
  const [source, setSource] = useState(null),
    [error, setError] = useState("");
  const [device, setDevice] = useState("Desktop"),
    [width, setWidth] = useState(0);
  const frame = useRef(null);
  useEffect(() => {
    let active = true;
    Promise.all([storefrontTemplate(), api("/stores/" + slug)])
      .then(([template, view]) => {
        if (active) setSource({ template, catalog: snapshot(view, "preview") });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [slug]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  // Avoid rebuilding an embedded storefront for every keystroke in a section.
  const [draft, setDraft] = useState(design);
  useEffect(() => {
    const timer = setTimeout(() => setDraft(design), 180);
    return () => clearTimeout(timer);
  }, [design]);
  const html = useMemo(() => {
    if (!source) return "";
    const template = source.template.replace(
      '{"apiOrigin":"","slug":""}',
      JSON.stringify({ preview: group }),
    );
    return fillTemplate(template, {
      ...source.catalog,
      brand: {
        ...source.catalog.brand,
        homepage: { ...brand.homepage, layout: JSON.stringify(draft) },
      },
    });
  }, [source, brand.homepage, draft, group]);
  const viewport = device === "Desktop" ? 1024 : 375;
  const scale = Math.min(1, width / viewport);
  const height = device === "Desktop" ? 720 : 740;
  return (
    <div className="designPreview">
      <div className="previewButtons">
        <strong>Store preview</strong>
        {["Desktop", "Mobile"].map((d) => (
          <button
            type="button"
            key={d}
            aria-pressed={d === device}
            onClick={() => setDevice(d)}
          >
            {d}
          </button>
        ))}
      </div>
      <Message text={error} />
      <div
        className="previewFrame"
        ref={frame}
        style={{ height: Math.max(100, Math.ceil(height * scale) + 2) }}
      >
        {html && (
          <iframe
            title="Store layout preview"
            sandbox="allow-scripts"
            srcDoc={html}
            style={{
              width: viewport,
              height,
              marginLeft: (-viewport * scale) / 2,
              transform: "scale(" + scale + ")",
            }}
          />
        )}
      </div>
    </div>
  );
}
export default function StoreDesigner({ brand, savedLayout, busy, save }) {
  const [design, setDesign] = useState(() =>
    readDesign(brand.homepage?.layout),
  );
  const [group, setGroup] = useState("header");
  const dirty =
    JSON.stringify(design) !== JSON.stringify(readDesign(savedLayout));
  const block = design.blocks[group];
  const name = (id) =>
    sectionNames[id] || design.blocks[id]?.title || "Untitled section";
  const [notice, setNotice] = useState("");
  function addBlock() {
    const id = "block-" + crypto.getRandomValues(new Uint32Array(2)).join("-");
    setDesign((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [id]: {
          title: "New section",
          text: "",
          image: "",
          layout: "vertical",
          align: "left",
          visible: true,
        },
      },
      order: [...prev.order, id],
    }));
    setGroup(id);
  }
  function updateBlock(key, value) {
    setDesign((prev) => ({
      ...prev,
      blocks: {
        ...prev.blocks,
        [group]: { ...prev.blocks[group], [key]: value },
      },
    }));
  }
  function removeBlock() {
    const blocks = { ...design.blocks };
    delete blocks[group];
    setDesign({
      ...design,
      blocks,
      order: design.order.filter((id) => id !== group),
    });
    setGroup("order");
  }
  function submit() {
    if (
      Object.values(design.blocks).some(
        (b) => b.image && !/^https:\/\/[^\s/]+/i.test(b.image),
      )
    ) {
      setNotice("Use a direct HTTPS image URL in each custom section.");
      return;
    }
    if (JSON.stringify(design).length > 12000) {
      setNotice(
        "Layout exceeds the store setting size. Shorten the custom section text or image URLs.",
      );
      return;
    }
    setNotice("");
    save(design);
  }
  function move(i, step) {
    setDesign((prev) => {
      const order = [...prev.order];
      [order[i], order[i + step]] = [order[i + step], order[i]];
      return { ...prev, order };
    });
  }
  return (
    <section className="panel">
      <h2>Store designer</h2>
      <div className="designWorkspace">
        <div className="form">
          <label>
            Design area
            <select
              aria-label="Design area"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              {Object.entries(designGroups).map(([k, [name]]) => (
                <option key={k} value={k}>
                  {name}
                </option>
              ))}
              {Object.keys(design.blocks).map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
              <option value="order">Homepage section order</option>
            </select>
          </label>
          {group === "order" ? (
            <ol className="sectionOrder">
              {design.order.map((id, i) => (
                <li key={id}>
                  <span>{name(id)}</span>
                  {[-1, 1].map((step) => (
                    <button
                      type="button"
                      key={step}
                      aria-label={
                        "Move " + name(id) + (step < 0 ? " up" : " down")
                      }
                      disabled={i + step < 0 || i + step >= design.order.length}
                      onClick={() => move(i, step)}
                    >
                      {step < 0 ? "↑" : "↓"}
                    </button>
                  ))}
                </li>
              ))}
            </ol>
          ) : block ? (
            <>
              <label>
                Section heading
                <input
                  aria-label="Custom section heading"
                  value={block.title}
                  onChange={(e) => updateBlock("title", e.target.value)}
                />
              </label>
              <label>
                Section text
                <textarea
                  aria-label="Custom section text"
                  rows={4}
                  value={block.text}
                  onChange={(e) => updateBlock("text", e.target.value)}
                />
              </label>
              <label>
                Photo URL (optional)
                <input
                  aria-label="Custom section photo URL"
                  type="url"
                  placeholder="https://…"
                  value={block.image}
                  onChange={(e) => updateBlock("image", e.target.value)}
                />
              </label>
              <label>
                Section layout
                <select
                  aria-label="Custom section layout"
                  value={block.layout}
                  onChange={(e) => updateBlock("layout", e.target.value)}
                >
                  <option value="vertical">Stacked</option>
                  <option value="horizontal">Side by side</option>
                </select>
              </label>
              <label>
                Text alignment
                <select
                  aria-label="Custom section text alignment"
                  value={block.align}
                  onChange={(e) => updateBlock("align", e.target.value)}
                >
                  {["left", "center", "right"].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={block.visible}
                  onChange={(e) => updateBlock("visible", e.target.checked)}
                />
                Show on storefront
              </label>
              <button className="remove" type="button" onClick={removeBlock}>
                Remove from draft
              </button>
            </>
          ) : (
            Object.entries(designGroups[group][1]).map(
              ([key, [label, choices]]) => (
                <label key={key}>
                  {label}
                  <select
                    aria-label={label}
                    value={design[key]}
                    onChange={(e) =>
                      setDesign({ ...design, [key]: e.target.value })
                    }
                  >
                    {Object.entries(choices).map(([v, name]) => (
                      <option key={v} value={v}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              ),
            )
          )}
          <button type="button" className="secondary" onClick={addBlock}>
            Add custom section
          </button>
          {dirty && <small>Unsaved design</small>}
          <Message text={notice} />
          <button
            className="cta"
            type="button"
            disabled={busy}
            onClick={submit}
          >
            Save design
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busy}
            onClick={() =>
              setDesign({
                ...readDesign(),
                blocks: design.blocks,
                order: [
                  ...Object.keys(sectionNames),
                  ...Object.keys(design.blocks),
                ],
              })
            }
          >
            Preview default layout
          </button>
        </div>
        <Preview
          slug={brand.slug}
          brand={brand}
          design={design}
          group={group}
        />
      </div>
    </section>
  );
}
