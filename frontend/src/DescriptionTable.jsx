import React, { useState } from "react";
export default function DescriptionTable({ initial, apply, cancel }) {
  const [rows, setRows] = useState(
    () =>
      initial || [
        ["Feature", "Specification"],
        ["", ""],
      ],
  );
  const cols = rows[0].length;
  function change(i, j, value) {
    setRows((prev) =>
      prev.map((r, n) =>
        n === i ? r.map((v, k) => (k === j ? value : v)) : r,
      ),
    );
  }
  const valid =
    rows[0].every((v) => v.trim()) &&
    rows.slice(1).some((row) => row.some((v) => v.trim()));
  return (
    <fieldset className="detailTableEditor">
      <legend>{initial ? "Edit table" : "Insert table"}</legend>
      <p>
        Enter your column headings in the first row and product specifications
        below.
      </p>
      <div className="detailTableScroll">
        <table>
          <thead>
            <tr>
              {rows[0].map((v, j) => (
                <th key={j} scope="col">
                  <input
                    aria-label={"Column " + (j + 1) + " heading"}
                    value={v}
                    onChange={(e) => change(0, j, e.target.value)}
                  />
                  {cols > 1 && (
                    <button
                      type="button"
                      className="remove"
                      aria-label={"Remove column " + (j + 1)}
                      onClick={() =>
                        setRows(
                          rows.map((row) => row.filter((_, k) => k !== j)),
                        )
                      }
                    >
                      Remove column
                    </button>
                  )}
                </th>
              ))}
              <th scope="col">Rows</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>
                    <input
                      aria-label={"Row " + (i + 1) + ", column " + (j + 1)}
                      value={v}
                      onChange={(e) => change(i + 1, j, e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button
                    className="remove"
                    type="button"
                    disabled={rows.length <= 2}
                    aria-label={"Remove row " + (i + 1)}
                    onClick={() => setRows(rows.filter((_, k) => k !== i + 1))}
                  >
                    Remove row
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button
          className="secondary"
          type="button"
          onClick={() => setRows([...rows, Array(cols).fill("")])}
        >
          Add row
        </button>
        <button
          className="secondary"
          type="button"
          onClick={() =>
            setRows(
              rows.map((r, i) => [...r, i === 0 ? "Column " + (cols + 1) : ""]),
            )
          }
        >
          Add column
        </button>
        <button
          className="cta"
          type="button"
          disabled={!valid}
          onClick={() => apply(rows)}
        >
          Apply table
        </button>
        <button className="secondary" type="button" onClick={cancel}>
          Cancel table edit
        </button>
      </div>
    </fieldset>
  );
}
