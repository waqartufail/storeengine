// The saved value is plain text so existing descriptions, translations and exports
// use the same field. Only a header followed by a divider starts a table.
export const listMarker = /^\s*(?:([-*•])|(\d{1,9})[.)])\s+(.*)$/;
function cells(line) {
  const row = line.trim();
  if (!row.startsWith("|") || !row.endsWith("|") || row.length < 2) return null;
  const values = [];
  let cell = "";
  for (let i = 1; i < row.length - 1; i++) {
    const c = row[i];
    if (
      c === "\\" &&
      ["|", "\\"].includes(row[i + 1]) &&
      i + 1 < row.length - 1
    )
      cell += row[++i];
    else if (c === "|") {
      values.push(cell.trim());
      cell = "";
    } else cell += c;
  }
  values.push(cell.trim());
  return values;
}
export function writeTable(rows) {
  const line = (row) =>
    "| " +
    row.map((v) => v.trim().replace(/[\\|]/g, "\\$&")).join(" | ") +
    " |";
  return [
    line(rows[0]),
    line(rows[0].map(() => "---")),
    ...rows.slice(1).map(line),
  ].join("\n");
}
export function descriptionBlocks(value) {
  const lines = value.split("\n");
  const blocks = [];
  let offset = 0;
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    const start = offset;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const head = cells(line);
    const divider = head && cells(lines[i + 1] || "");
    const marker = line.match(listMarker);
    let block;
    let j = i + 1;
    if (
      head &&
      divider?.length === head.length &&
      divider.every((v) => /^:?-{3,}:?$/.test(v))
    ) {
      const rows = [head];
      j++;
      while (j < lines.length) {
        const next = cells(lines[j]);
        if (next?.length !== head.length) break;
        rows.push(next);
        j++;
      }
      block = { type: "table", rows };
    } else if (heading)
      block = {
        type: heading[1].length === 3 ? "h5" : "h4",
        content: heading[2],
      };
    else if (marker) {
      const type = marker[1] ? "ul" : "ol";
      const items = [marker[3]];
      while (j < lines.length) {
        const next = lines[j].match(listMarker);
        if (!next || (next[1] ? "ul" : "ol") !== type) break;
        items.push(next[3]);
        j++;
      }
      block = { type, items, first: Number(marker[2]) };
    } else if (line.trim()) {
      const previous = blocks.at(-1);
      if (previous?.type === "p" && previous.end + 1 === start) {
        previous.content += "\n" + line;
        previous.end += 1 + line.length;
      } else block = { type: "p", content: line };
    }
    while (i < j) offset += lines[i++].length + 1;
    if (block) blocks.push({ ...block, start, end: offset - 1 });
  }
  return blocks;
}
