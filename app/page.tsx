"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import AuthPanel from "@/components/AuthPanel";
import PlanCard from "@/components/PlanCard";
import ScheduleModal from "@/components/ScheduleModal";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { formatNumbers, removeEmptyRowsAndColumns, trimWhitespace } from "@/lib/smart-clean";

type ExtractedTable = { index: number; headers: string[]; rows: string[][] };
type ExtractResponse = {
  url: string;
  title: string;
  tables: ExtractedTable[];
  usedToday: number;
  dailyLimit: number | null;
  remainingToday: number | null;
  plan: "free" | "pro";
};

const SAMPLE_URLS = [
  { label: "Try: Wikipedia Table", url: "https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_area" },
  { label: "Try: Company Earnings Table", url: "https://companiesmarketcap.com/apple/earnings/" },
];

function escapeCsv(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<ExtractResponse | null>(null);
  const [selectedTableIndex, setSelectedTableIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [guestUsage, setGuestUsage] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cleanMessage, setCleanMessage] = useState("");
  const extractorControlsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setIsAuthenticated(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    const handleAuthSignedIn = () => {
      const pendingUrl = window.sessionStorage.getItem("pending_extraction_url");
      if (!pendingUrl) return;
      window.sessionStorage.removeItem("pending_extraction_url");
      setUrl(pendingUrl);
      void extractUrl(pendingUrl);
    };
    window.addEventListener("auth-signed-in", handleAuthSignedIn);
    setGuestUsage(getGuestUsage());
    const handleSignedIn = () => {
      setError("");
      setUsageRemaining(null);
      requestAnimationFrame(() => {
        extractorControlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("auth-signed-in", handleSignedIn);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("auth-signed-in", handleSignedIn);
    };
  }, []);

  const table = data?.tables[selectedTableIndex] ?? null;

  function getGuestUsage() {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("guest_extractions") ?? "0");
  }

  function openAuth(mode: "login" | "signup" = "signup") {
    window.dispatchEvent(new CustomEvent("open-auth", { detail: mode }));
  }

  function updateSelectedTable(updater: (table: ExtractedTable) => ExtractedTable) {
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        tables: current.tables.map((item, index) => index === selectedTableIndex ? updater(item) : item),
      };
    });
  }

  const csv = useMemo(() => {
    if (!table) return "";
    return [
      "\ufeff" + table.headers.map(escapeCsv).join(","),
      ...table.rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\n");
  }, [table]);

  const tsv = useMemo(() => {
    if (!table) return "";
    return [
      table.headers.map((value) => value.replace(/\t|\r?\n/g, " ")).join("\t"),
      ...table.rows.map((row) => row.map((value) => value.replace(/\t|\r?\n/g, " ")).join("\t"))
    ].join("\n");
  }, [table]);

  async function extractUrl(targetUrl: string) {
    setError("");
    setCleanMessage("");
    setData(null);
    setSelectedTableIndex(0);

    if (!targetUrl.trim()) {
      setError("Enter a webpage URL first.");
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const currentGuestUsage = getGuestUsage();

      if (!accessToken && currentGuestUsage >= 3) {
        setLoading(false);
        window.sessionStorage.setItem("pending_extraction_url", targetUrl.trim());
        setError("");
        openAuth("signup");
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch("/api/extract", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: targetUrl.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.code === "GUEST_LIMIT_REACHED") {
          setLoading(false);
          setGuestUsage(3);
          window.sessionStorage.setItem("pending_extraction_url", targetUrl.trim());
          setError("");
          openAuth("signup");
          return;
        }
        throw new Error(payload.error ?? "Extraction failed.");
      }
      setData(payload);
      setUsageRemaining(payload.remainingToday);
      if (accessToken) {
        window.sessionStorage.removeItem("pending_extraction_url");
      }
      requestAnimationFrame(() => {
        extractorControlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      if (!accessToken) {
        const nextGuestUsage = currentGuestUsage + 1;
        window.localStorage.setItem("guest_extractions", String(nextGuestUsage));
        setGuestUsage(nextGuestUsage);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed.";
      setError(
        message.includes("too large or slow") || message.includes("timed out") || message.includes("timeout")
          ? "The target website is too large or slow to respond. Please try a different URL."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  async function extract(event: FormEvent) {
    event.preventDefault();
    await extractUrl(url);
  }

  async function runSample(sampleUrl: string) {
    setUrl(sampleUrl);
    await extractUrl(sampleUrl);
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    updateSelectedTable((item) => ({
      ...item,
      rows: item.rows.map((row, index) =>
        index === rowIndex ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell) : row
      ),
    }));
  }

  function updateHeader(columnIndex: number, value: string) {
    updateSelectedTable((item) => ({
      ...item,
      headers: item.headers.map((header, index) => index === columnIndex ? value : header),
    }));
  }

  function addRow() {
    if (!table) return;
    updateSelectedTable((item) => ({ ...item, rows: [...item.rows, Array(item.headers.length).fill("")] }));
  }

  function deleteRow(rowIndex: number) {
    updateSelectedTable((item) => ({ ...item, rows: item.rows.filter((_, index) => index !== rowIndex) }));
  }

  function addColumn() {
    updateSelectedTable((item) => ({
      ...item,
      headers: [...item.headers, `Column ${item.headers.length + 1}`],
      rows: item.rows.map((row) => [...row, ""]),
    }));
  }

  function deleteColumn(columnIndex: number) {
    if (!table || table.headers.length <= 1) return;
    updateSelectedTable((item) => ({
      ...item,
      headers: item.headers.filter((_, index) => index !== columnIndex),
      rows: item.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
    }));
  }

  function smartClean(operation: "trim" | "empty" | "numbers") {
    if (!table) return;
    updateSelectedTable((item) => {
      if (operation === "trim") return { ...item, ...trimWhitespace(item) };
      if (operation === "empty") return { ...item, ...removeEmptyRowsAndColumns(item) };
      return { ...item, ...formatNumbers(item) };
    });
    const labels = { trim: "Whitespace cleaned.", empty: "Empty rows and columns removed.", numbers: "Numbers formatted." };
    setCleanMessage(labels[operation]);
  }

  async function copyToGoogleSheets() {
    if (!tsv) return;
    try {
      await navigator.clipboard.writeText(tsv);
      setCleanMessage("Copied as TSV. Paste directly into Google Sheets or Excel.");
    } catch {
      setError("Could not access the clipboard. Please use Export CSV instead.");
    }
  }

  function downloadJson() {
    if (!table) return;
    const records = table.rows.map((row) =>
      Object.fromEntries(table.headers.map((header, index) => [
        header || `Column ${index + 1}`,
        row[index] ?? ""
      ]))
    );
    const payload = {
      sourceUrl: data?.url ?? "",
      pageTitle: data?.title ?? "",
      tableNumber: selectedTableIndex + 1,
      columns: table.headers,
      rowCount: table.rows.length,
      data: records
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `extracted-table-${selectedTableIndex + 1}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  function downloadCsv() {
    if (!csv) return;
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `extracted-table-${selectedTableIndex + 1}.csv`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function downloadExcel() {
    if (!table) return;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Web Table Extractor";
    workbook.created = new Date();
    workbook.modified = new Date();

    const worksheet = workbook.addWorksheet(`Table ${selectedTableIndex + 1}`, {
      views: [{ state: "frozen", ySplit: 1 }]
    });

    worksheet.columns = table.headers.map((header, index) => {
      const values = [header, ...table.rows.map((row) => row[index] ?? "")];
      const maxLength = Math.max(...values.map((value) => String(value).length), 10);
      return { header, key: `column${index}`, width: Math.min(maxLength + 3, 45) };
    });

    table.rows.forEach((row) => worksheet.addRow(row));

    const headerRow = worksheet.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
      cell.alignment = { vertical: "middle", horizontal: "left" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD1D5DB" } },
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } }
      };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "top", wrapText: true };
        cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
        if (rowNumber % 2 === 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
        }
      });
    });

    const lastRow = worksheet.rowCount;
    const lastColumn = worksheet.columnCount;
    if (lastRow > 0 && lastColumn > 0) {
      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: lastRow, column: lastColumn }
      };
    }

    worksheet.getColumn(1).width = Math.max(worksheet.getColumn(1).width ?? 10, 14);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `extracted-table-${selectedTableIndex + 1}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  const isPro = data?.plan === "pro";

  return (
    <main>
      <AuthPanel />
      <section className="hero">
        <div className="container">
          <div className="hero-topline">
            <div className="eyebrow">Autonomous Web Data Extractor</div>
          </div>
          <h1>Turn web tables into clean data.</h1>
          <p className="subtitle">
            Paste a public webpage URL. The engine finds HTML tables, extracts their headers and rows,
            and lets you edit and export the selected table as CSV, JSON, and Excel.
          </p>
        </div>
      </section>

      <section className="container extractor-section">
        <div className="panel extractor-panel" id="extractor-controls" ref={extractorControlsRef}>
          <form className="form" onSubmit={extract}>
            <input
              className="input"
              type="url"
              placeholder="https://example.com/page-with-a-table"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-label="Webpage URL"
            />
            <button className="primary" disabled={loading} type="submit">
              {loading ? "Extracting..." : "Extract tables"}
            </button>
            {isAuthenticated && isPro && (
              <button
                className="secondary schedule-trigger"
                disabled={!data || loading}
                type="button"
                onClick={() => setScheduleOpen(true)}
              >
                Schedule Extraction
              </button>
            )}
          </form>

          <div className="sample-actions" aria-label="Sample URLs">
            <span>Quick start</span>
            {SAMPLE_URLS.map((sample) => (
              <button
                key={sample.label}
                className="sample-link"
                type="button"
                disabled={loading}
                onClick={() => void runSample(sample.url)}
              >
                {sample.label}
              </button>
            ))}
          </div>

          {error && <div className="error">{error}</div>}
          {usageRemaining !== null && !error && isAuthenticated && data?.plan === "free" && (
            <div className="usage-banner">Free plan: <strong>{usageRemaining}/3</strong> extractions remaining today.</div>
          )}

        </div>

        {isAuthenticated && <PlanCard />}

        {data && (
          <section className="results">
            <div className="result-header">
              <div>
                <h2>{data.title || "Extracted tables"}</h2>
                <div className="meta">
                  {data.tables.length} table{data.tables.length === 1 ? "" : "s"} detected ·{" "}
                  {data.plan === "pro" ? "Pro plan · unlimited daily extractions" : `${isAuthenticated ? data.remainingToday : Math.max(3 - guestUsage, 0)}/3 free extractions remaining today`}
                </div>
              </div>
              <div className="export-actions">
                <button className="secondary" onClick={downloadCsv} disabled={!table}>Export CSV</button>
                <button className="secondary" onClick={() => { if (isPro) downloadJson(); else window.dispatchEvent(new CustomEvent("open-pricing")); }} disabled={!table}>Export JSON{!isPro && " · Pro"}</button>
                <button className="primary" onClick={() => { if (isPro) void downloadExcel(); else window.dispatchEvent(new CustomEvent("open-pricing")); }} disabled={!table}>Export Excel{!isPro && " · Pro"}</button>
                <button className="secondary" onClick={() => void copyToGoogleSheets()} disabled={!table}>Copy to Google Sheets</button>
              </div>
            </div>

            {data.tables.length > 0 && (
              <div className="table-selector table-tabs" role="tablist" aria-label="Extracted tables">
                {data.tables.map((item, index) => (
                  <button
                    key={item.index}
                    className={index === selectedTableIndex ? "table-tab active" : "table-tab"}
                    onClick={() => { setSelectedTableIndex(index); setCleanMessage(""); }}
                    type="button"
                    role="tab"
                    aria-selected={index === selectedTableIndex}
                  >
                    <span className="table-tab-title">Table {index + 1}</span>
                    <span>{item.rows.length} rows</span>
                  </button>
                ))}
              </div>
            )}

            {table ? (
              <>
                <div className="smart-clean-toolbar">
                  <div>
                    <strong>Smart Clean</strong>
                    <span>Clean the selected table before export.</span>
                  </div>
                  <div className="smart-clean-actions">
                    <button className="secondary" onClick={() => isPro ? smartClean("trim") : window.dispatchEvent(new CustomEvent("open-pricing"))} type="button">Trim Whitespace{!isPro && " · Pro"}</button>
                    <button className="secondary" onClick={() => isPro ? smartClean("empty") : window.dispatchEvent(new CustomEvent("open-pricing"))} type="button">Remove Empty Rows/Cols{!isPro && " · Pro"}</button>
                    <button className="secondary" onClick={() => isPro ? smartClean("numbers") : window.dispatchEvent(new CustomEvent("open-pricing"))} type="button">Format Numbers{!isPro && " · Pro"}</button>
                  </div>
                </div>

                {cleanMessage && <div className="clean-message">{cleanMessage}</div>}

                <div className="editor-toolbar">
                  <span>Edit cells directly in the table.</span>
                  <div className="toolbar-actions">
                    <button className="secondary" onClick={addRow} type="button">+ Row</button>
                    <button className="secondary" onClick={addColumn} type="button">+ Column</button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {table.headers.map((header, columnIndex) => (
                          <th key={columnIndex} className={columnIndex === 0 ? "sticky-first-column" : ""}>
                            <div className="header-editor">
                              <input
                                value={header}
                                onChange={(event) => updateHeader(columnIndex, event.target.value)}
                                aria-label={`Column ${columnIndex + 1} header`}
                              />
                              <button
                                className="delete-column"
                                onClick={() => deleteColumn(columnIndex)}
                                disabled={table.headers.length <= 1}
                                title="Delete column"
                                type="button"
                              >
                                ×
                              </button>
                            </div>
                          </th>
                        ))}
                        <th className="row-actions-heading">Row</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {table.headers.map((_, columnIndex) => (
                            <td key={columnIndex} className={columnIndex === 0 ? "sticky-first-column" : ""}>
                              <input
                                value={row[columnIndex] ?? ""}
                                onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                                aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                              />
                            </td>
                          ))}
                          <td className="row-action">
                            <button className="delete-row" onClick={() => deleteRow(rowIndex)} title={`Delete row ${rowIndex + 1}`} type="button">
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {table.rows.length === 0 && <div className="panel empty">No rows remain. Use + Row to add one.</div>}
              </>
            ) : (
              <div className="panel empty">No HTML tables were found on this page.</div>
            )}
          </section>
        )}
      </section>

      {isAuthenticated && isPro && data && (
        <ScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          sourceUrl={data.url}
          tableIndex={selectedTableIndex}
        />
      )}
    </main>
  );
}
