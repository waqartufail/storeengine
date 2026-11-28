import React, { useRef, useState, useLayoutEffect } from "react";
import { descriptionBlocks, listMarker, writeTable } from "./descriptionBlocks";
import DescriptionTable from "./DescriptionTable";

export function Description({ text }) {
  return (
    <div className="formattedDetails">
      {descriptionBlocks(text).map((block) => {
        const Tag = block.type,
          key = block.start;
        if (Tag === "table")
          return (
            <div className="detailTableScroll" key={key} tabIndex={0}>
              <table>
                <thead>
                  <tr>
                    {block.rows[0].map((v, i) => (
                      <th key={i} scope="col">
                        {v}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.slice(1).map((row, i) => (
                    <tr key={i}>
                      {row.map((v, j) => (
                        <td key={j}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        if (Tag === "ol" || Tag === "ul")
          return (
            <Tag key={key} start={Tag === "ol" ? block.first : undefined}>
              {block.items.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </Tag>
          );
        return (
          <Tag
            key={key}
            className={Tag === "p" ? "longDescription" : undefined}
          >
            {block.content}
          </Tag>
        );
      })}
    </div>
  );
}

export function DescriptionEditor({ value, onChange, onTableOpen }) {
  const input = useRef(null),
    selection = useRef(null);
  const [edit, setEdit] = useState(null),
    [notice, say] = useState("");
  function restore() {
    if (!selection.current) return;
    input.current.focus();
    input.current.setSelectionRange(...selection.current);
    selection.current = null;
  }
  useLayoutEffect(restore, [value, edit]);
  function replace(start, end, content, focusFrom, focusTo = focusFrom) {
    const next = value.slice(0, start) + content + value.slice(end);
    if (next.length > 16000) {
      say(
        "Product details can contain up to 16,000 characters. Shorten the description or table.",
      );
      return false;
    }
    say("");
    selection.current = [focusFrom, focusTo];
    if (next === value) restore();
    else onChange(next);
    return true;
  }
  function range(multiple = false) {
    const box = input.current,
      caret = box.selectionStart;
    const start = value.slice(0, caret).lastIndexOf("\n") + 1;
    const last = multiple ? Math.max(caret, box.selectionEnd - 1) : caret;
    const end = value.indexOf("\n", last);
    return [start, end < 0 ? value.length : end];
  }
  function heading(prefix) {
    const [start, end] = range();
    const title =
      value.slice(start, end).replace(/^#{1,3}\s+/, "") || "Heading";
    replace(
      start,
      end,
      prefix + title,
      start + prefix.length,
      start + prefix.length + title.length,
    );
  }
  function list(numbered) {
    const [start, end] = range(true);
    const lines = value.slice(start, end).split("\n");
    const remove = lines.every((l) => {
      const m = l.match(listMarker);
      return m && !!m[2] === numbered;
    });
    let index = 0;
    const content = lines
      .map((l) => {
        if (!l.trim() && lines.length > 1) {
          index = 0;
          return l;
        }
        const item = l.match(listMarker)?.[3] ?? l;
        if (remove) return item;
        return (numbered ? ++index + ". " : "- ") + (item || "List item");
      })
      .join("\n");
    const first =
      start +
      (value.slice(start, end) === "" && !remove ? (numbered ? 3 : 2) : 0);
    replace(start, end, content, first, start + content.length);
  }
  function continueList(e) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    const box = input.current;
    if (box.selectionStart !== box.selectionEnd) return;
    const [start, end] = range();
    const m = value.slice(start, end).match(listMarker);
    if (!m || box.selectionStart !== end) return;
    e.preventDefault();
    if (!m[3].trim()) {
      replace(start, end, "", start);
      return;
    }
    const prefix = "\n" + (m[1] ? m[1] + " " : Number(m[2]) + 1 + ". ");
    replace(end, end, prefix, end + prefix.length);
  }
  const tables = descriptionBlocks(value).filter((b) => b.type === "table");
  function open(table) {
    const [, end] = range();
    const containing = tables.find((t) => t.start <= end && t.end >= end);
    const at = containing?.end ?? end;
    setEdit(table || { start: at, end: at });
    say("");
    onTableOpen(true);
  }
  function close() {
    setEdit(null);
    say("");
    onTableOpen(false);
  }
  function apply(rows) {
    const left = value.slice(0, edit.start),
      right = value.slice(edit.end);
    const before =
      !edit.rows && left
        ? "\n".repeat(Math.max(0, 2 - left.match(/\n*$/)[0].length))
        : "";
    const after =
      !edit.rows && right
        ? "\n".repeat(Math.max(0, 2 - right.match(/^\n*/)[0].length))
        : "";
    const content = before + writeTable(rows) + after;
    if (replace(edit.start, edit.end, content, edit.start + content.length))
      close();
  }
  return (
    <>
      <div className="actions" role="group" aria-label="Description formatting">
        {[
          ["Heading", () => heading("## ")],
          ["Subheading", () => heading("### ")],
          ["Bullet list", () => list(false)],
          ["Numbered list", () => list(true)],
          ["Insert table", () => open(null)],
        ].map(([label, fn]) => (
          <button
            key={label}
            type="button"
            className="secondary"
            disabled={!!edit}
            onClick={fn}
          >
            {label}
          </button>
        ))}
        {tables.map((table, i) => (
          <button
            key={table.start}
            type="button"
            className="secondary"
            disabled={!!edit}
            onClick={() => open(table)}
          >
            Edit table {i + 1}
          </button>
        ))}
      </div>
      <label>
        Full product description
        <textarea
          ref={input}
          rows={7}
          maxLength={16000}
          readOnly={!!edit}
          value={value}
          onKeyDown={continueList}
          onChange={(e) => {
            say("");
            onChange(e.target.value);
          }}
          placeholder="Write a description or select lines to format as a list."
        />
      </label>
      {edit && (
        <DescriptionTable initial={edit.rows} apply={apply} cancel={close} />
      )}
      {notice && <p role="status">{notice}</p>}
      {value && (
        <details>
          <summary>Preview description</summary>
          <Description text={value} />
        </details>
      )}
    </>
  );
}
