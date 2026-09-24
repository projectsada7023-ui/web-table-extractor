"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import AuthPanel from "@/components/AuthPanel";
import PlanCard from "@/components/PlanCard";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ExtractedTable = { index: number; headers: string[]; rows: string[][] };
type ExtractResponse = { url: string; title: string; tables: ExtractedTable[]; usedToday: number; dailyLimit: number | null; remainingToday: number | null; plan: "free" | "pro" };

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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setIsAuthenticated(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });
    setGuestUsage(getGuestUsage());
    return () => listener.subscription.unsubscribe();
  }, []);

  const table = data?.tables[selectedTableIndex] ?? null;

  function getGuestUsage() {
    if (typeof window === "undefined") return 0;
    return Number(window.localStorage.getItem("guest_extractions") ?? "0");
  }

  function openAuth(mode: "login" | "signup" = "signup") {
    window.dispatchEvent(new CustomEvent("open-auth", { detail: mode }));
  }

  const csv = useMemo(() => {
    if (!table) return "";
    return [
      "\ufeff" + table.headers.map(escapeCsv).join(","),
      ...table.rows.map((row) => row.map(escapeCsv).join(","))
    ].join("\n");
  }, [table]);

  async function extract(event: FormEvent) {
    event.preventDefault();
    setError("");
    setData(null);
    setSelectedTableIndex(0);
    if (!url.trim()) {
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
        setError("You've used your 3 free guest extractions. Create a free account to continue.");
        openAuth("signup");
        return;
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      else headers["x-guest-extractions"] = String(currentGuestUsage);

      const response = await fetch("/api/extract", {
        method: "POST",
        headers,
        body: JSON.stringify({ url: url.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Extraction failed.");
      setData(payload);
      setUsageRemaining(payload.remainingToday);
      if (!accessToken) {
        const nextGuestUsage = currentGuestUsage + 1;
        window.localStorage.setItem("guest_extractions", String(nextGuestUsage));
        setGuestUsage(nextGuestUsage);
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : "Extraction failed.";
      setError(message.includes("too large or slow") || message.includes("timed out") || message.includes("timeout")
        ? "The target website is too large or slow to respond. Please try a different URL."
        : message);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(rowIndex: number, columnIndex: number, value: string) {
    if (!data) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) => {
        if (tableIndex !== selectedTableIndex) return item;
        const rows = item.rows.map((row, index) =>
          index === rowIndex
            ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell)
            : row
        );
        return { ...item, rows };
      });
      return { ...current, tables };
    });
  }

  function updateHeader(columnIndex: number, value: string) {
    if (!data) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) => {
        if (tableIndex !== selectedTableIndex) return item;
        const headers = item.headers.map((header, index) => index === columnIndex ? value : header);
        return { ...item, headers };
      });
      return { ...current, tables };
    });
  }

  function addRow() {
    if (!data || !table) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) =>
        tableIndex === selectedTableIndex
          ? { ...item, rows: [...item.rows, Array(item.headers.length).fill("")] }
          : item
      );
      return { ...current, tables };
    });
  }

  function deleteRow(rowIndex: number) {
    if (!data) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) =>
        tableIndex === selectedTableIndex
          ? { ...item, rows: item.rows.filter((_, index) => index !== rowIndex) }
          : item
      );
      return { ...current, tables };
    });
  }

  function addColumn() {
    if (!data) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) =>
        tableIndex === selectedTableIndex
          ? {
              ...item,
              headers: [...item.headers, `Column ${item.headers.length + 1}`],
              rows: item.rows.map((row) => [...row, ""]),
            }
          : item
      );
      return { ...current, tables };
    });
  }

  function deleteColumn(columnIndex: number) {
    if (!data || !table || table.headers.length <= 1) return;
    setData((current) => {
      if (!current) return current;
      const tables = current.tables.map((item, tableIndex) =>
        tableIndex === selectedTableIndex
          ? {
              ...item,
              headers: item.headers.filter((_, index) => index !== columnIndex),
              rows: item.rows.map((row) => row.filter((_, index) => index !== columnIndex)),
            }
          : item
      );
      return { ...current, tables };
    });
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
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
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
      return {
        header,
        key: `column${index}`,
        width: Math.min(maxLength + 3, 45)
      };
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
        cell.border = {
          bottom: { style: "hair", color: { argb: "FFE5E7EB" } }
        };
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
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `extracted-table-${selectedTableIndex + 1}.xlsx`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

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
        <div className="panel extractor-panel">
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
          </form>
          {error && <div className="error">{error}</div>}
          {usageRemaining !== null && !error && isAuthenticated && (
            <div className="usage-banner">Free plan: <strong>{usageRemaining}/3</strong> extractions remaining today.</div>
          )}
          {!isAuthenticated && !error && !data && (
            <div className="guest-plan-note">Free plan: 3 successful extractions per day.</div>
          )}
        </div>

        {isAuthenticated && <PlanCard />}

        {data && (
          <section className="results">
            <div className="result-header">
              <div>
                <h2>{data.title || "Extracted tables"}</h2>
                <div className="meta">
                  {data.tables.length} table{data.tables.length === 1 ? "" : "s"} detected · {data.plan === "pro" ? "Pro plan · unlimited daily extractions" : `${data.remainingToday}/3 free extractions remaining today`}
                </div>
              </div>
              <div className="export-actions">
                <button className="secondary" onClick={downloadCsv} disabled={!table}>
                  Export CSV
                </button>
                <button className="secondary" onClick={downloadJson} disabled={!table}>
                  Export JSON
                </button>
                <button className="primary" onClick={downloadExcel} disabled={!table}>
                  Export Excel
                </button>
              </div>
            </div>

            {data.tables.length > 0 && (
              <div className="table-selector">
                {data.tables.map((item, index) => (
                  <button
                    key={item.index}
                    className={index === selectedTableIndex ? "table-tab active" : "table-tab"}
                    onClick={() => setSelectedTableIndex(index)}
                    type="button"
                  >
                    Table {index + 1}
                    <span>{item.rows.length} rows</span>
                  </button>
                ))}
              </div>
            )}

            {table ? (
              <>
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
                          <th key={columnIndex}>
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
                            <td key={columnIndex}>
                              <input
                                value={row[columnIndex] ?? ""}
                                onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                                aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}`}
                              />
                            </td>
                          ))}
                          <td className="row-action">
                            <button
                              className="delete-row"
                              onClick={() => deleteRow(rowIndex)}
                              title={`Delete row ${rowIndex + 1}`}
                              type="button"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {table.rows.length === 0 && (
                  <div className="panel empty">No rows remain. Use + Row to add one.</div>
                )}
              </>
            ) : (
              <div className="panel empty">No HTML tables were found on this page.</div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
