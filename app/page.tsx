"use client";

import { FormEvent, useMemo, useState } from "react";

type ExtractedTable = { index: number; headers: string[]; rows: string[][] };
type ExtractResponse = { url: string; title: string; tables: ExtractedTable[] };

function escapeCsv(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const table = data?.tables[0] ?? null;
  const csv = useMemo(() => {
    if (!table) return "";
    return [
      table.headers.map(escapeCsv).join(","),
      ...table.rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\n");
  }, [table]);

  async function extract(event: FormEvent) {
    event.preventDefault();
    setError("");
    setData(null);
    if (!url.trim()) { setError("Enter a webpage URL first."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Extraction failed.");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setLoading(false);
    }
  }

  function downloadCsv() {
    if (!csv) return;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "extracted-table.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="eyebrow">Autonomous Web Data Extractor</div>
          <h1>Turn web tables into clean data.</h1>
          <p className="subtitle">Paste a public webpage URL. The engine finds HTML tables, extracts their headers and rows, and lets you export the first detected table as CSV.</p>
        </div>
      </section>
      <section className="container">
        <div className="panel">
          <form className="form" onSubmit={extract}>
            <input className="input" type="url" placeholder="https://example.com/page-with-a-table" value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Webpage URL" />
            <button className="primary" disabled={loading} type="submit">{loading ? "Extracting..." : "Extract tables"}</button>
          </form>
          {error && <div className="error">{error}</div>}
        </div>

        {data && (
          <section className="results">
            <div className="result-header">
              <div>
                <h2>{data.title || "Extracted table"}</h2>
                <div className="meta">{data.tables.length} table{data.tables.length === 1 ? "" : "s"} detected</div>
              </div>
              <button className="secondary" onClick={downloadCsv} disabled={!table}>Export CSV</button>
            </div>
            {table ? (
              <div className="table-wrap">
                <table>
                  <thead><tr>{table.headers.map((header, index) => <th key={index}>{header || `Column ${index + 1}`}</th>)}</tr></thead>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{table.headers.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] ?? ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="panel empty">No HTML tables were found on this page.</div>}
          </section>
        )}
      </section>
    </main>
  );
}
