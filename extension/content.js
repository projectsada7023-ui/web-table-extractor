function clean(value) {
  return value.replace(/\\s+/g, " ").trim();
}

function extractTables() {
  return Array.from(document.querySelectorAll("table")).map((table, index) => {
    const rows = Array.from(table.querySelectorAll("tr"))
      .map((row) =>
        Array.from(row.querySelectorAll("th, td")).map((cell) => clean(cell.innerText || cell.textContent || ""))
      )
      .filter((row) => row.length > 0);

    if (!rows.length) return null;

    const headerRow = table.querySelector("thead tr");
    const headerCells = headerRow
      ? Array.from(headerRow.querySelectorAll("th, td")).map((cell) => clean(cell.innerText || cell.textContent || ""))
      : rows[0];

    const width = Math.max(headerCells.length, ...rows.map((row) => row.length), 0);
    const headers = Array.from({ length: width }, (_, i) => headerCells[i] || `Column ${i + 1}`);

    // When a real <thead> exists, remove that header row from the data rows.
    // Otherwise, treat the first row as the header and keep the remaining rows as data.
    const dataRows = headerRow
      ? rows.slice(1)
      : rows.slice(1);

    const normalizedRows = dataRows.map((row) =>
      Array.from({ length: width }, (_, i) => row[i] || "")
    );

    return { index, headers, rows: normalizedRows };
  }).filter(Boolean);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "EXTRACT_TABLES") {
    sendResponse({
      title: document.title,
      url: window.location.href,
      tables: extractTables()
    });
  }
  return true;
});
