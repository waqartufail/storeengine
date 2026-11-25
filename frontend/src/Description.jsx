import React, { useRef, useLayoutEffect } from "react";
export function Description({ text }) {
  const blocks = [];
  let paragraph = [];
  function flush() {
    if (paragraph.length) {
      blocks.push(
        <p className="longDescription" key={blocks.length}>
          {paragraph.join("\n")}
        </p>,
      );
      paragraph = [];
    }
  }
  for (const line of text.split(/\r?\n/)) {
    const title = line.match(/^(#{1,3})\s+(.+)$/);
    if (title) {
      flush();
      const Tag = title[1].length === 3 ? "h5" : "h4";
      blocks.push(<Tag key={blocks.length}>{title[2]}</Tag>);
    } else if (!line.trim()) flush();
    else paragraph.push(line);
  }
  flush();
  return <div className="formattedDetails">{blocks}</div>;
}
export function DescriptionEditor({ value, onChange }) {
  const input = useRef(null);
  const selection = useRef(null);
  useLayoutEffect(() => {
    if (selection.current) {
      input.current.focus();
      input.current.setSelectionRange(...selection.current);
      selection.current = null;
    }
  }, [value]);
  function format(prefix) {
    const box = input.current;
    const start = value.slice(0, box.selectionStart).lastIndexOf("\n") + 1;
    const nextBreak = value.indexOf("\n", box.selectionStart);
    const end = nextBreak < 0 ? value.length : nextBreak;
    const line = value.slice(start, end).replace(/^#{1,3}\s+/, "");
    const content = line || "Heading";
    const next = value.slice(0, start) + prefix + content + value.slice(end);
    if (next.length > 16000) return;
    selection.current = [
      start + prefix.length,
      start + prefix.length + content.length,
    ];
    if (next === value) {
      box.focus();
      box.setSelectionRange(...selection.current);
      selection.current = null;
    } else onChange(next);
  }
  return (
    <>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() => format("## ")}
        >
          Heading
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => format("### ")}
        >
          Subheading
        </button>
      </div>
      <label>
        Full product description
        <textarea
          ref={input}
          rows={7}
          maxLength={16000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your description. Use Heading to format the current line."
        />
      </label>
      {value && (
        <details>
          <summary>Preview description</summary>
          <Description text={value} />
        </details>
      )}
    </>
  );
}
