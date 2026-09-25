let tables = [];
let selectedTable = 0;

const status = document.getElementById("status");
const tableSelect = document.getElementById("tableSelect");
const preview = document.getElementById("preview");
const exportCsv = document.getElementById("exportCsv");
const exportExcel = document.getElementById("exportExcel");

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\\n\\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderPreview() {
  const table = tables[selectedTable];
  if (!table) {
    preview.innerHTML = "";
    exportCsv.disabled = true;
    exportExcel.disabled = true;
    return;
  }

  const sample = table.rows.slice(0, 8);
  preview.innerHTML = `
    <table>
      <thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>
        ${sample.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
  exportCsv.disabled = false;
  exportExcel.disabled = false;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadCsv(table) {
  const csv = [
    "\ufeff" + table.headers.map(escapeCsv).join(","),
    ...table.rows.map((row) => row.map(escapeCsv).join(","))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `web-table-${selectedTable + 1}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");

    chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_TABLES" }, (result) => {
      if (chrome.runtime.lastError) {
        status.textContent = "This page cannot be scanned. Try a normal webpage.";
        return;
      }

      tables = result?.tables || [];
      if (!tables.length) {
        status.textContent = "No HTML tables found on this page.";
        return;
      }

      status.textContent = `${tables.length} table${tables.length === 1 ? "" : "s"} detected.`;
      tableSelect.innerHTML = tables
        .map((table, i) => `<option value="${i}">Table ${i + 1} — ${table.rows.length} rows × ${table.headers.length} columns</option>`)
        .join("");
      tableSelect.disabled = false;
      tableSelect.addEventListener("change", () => {
        selectedTable = Number(tableSelect.value);
        renderPreview();
      });
      renderPreview();
    });
  } catch {
    status.textContent = "Unable to read this page.";
  }
}

tableSelect.addEventListener("change", () => {
  selectedTable = Number(tableSelect.value);
  renderPreview();
});

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function exportExcelFile(table) {
  const allRows = [table.headers, ...table.rows];
  const widths = table.headers.map((header, index) => {
    const maxLength = Math.max(
      String(header ?? "").length,
      ...table.rows.map((row) => String(row[index] ?? "").length)
    );
    return Math.min(Math.max(maxLength + 2, 10), 36);
  });

  const rowsXml = allRows.map((row, rowIndex) => {
    const cells = table.headers.map((_, colIndex) => {
      const value = String(row[colIndex] ?? "");
      const type = /^-?\d+(\.\d+)?$/.test(value.trim()) ? "Number" : "String";
      return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");

  const colsXml = widths.map((width) => `<Column ss:AutoFitWidth="1" ss:Width="${width * 7}"/>`).join("");

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Extracted Table">
  <Table>
   ${colsXml}
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `web-table-${selectedTable + 1}.xls`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

exportExcel.addEventListener("click", () => {
  const table = tables[selectedTable];
  if (table) exportExcelFile(table);
});

exportCsv.addEventListener("click", () => {
  const table = tables[selectedTable];
  if (table) downloadCsv(table);
});

init();
