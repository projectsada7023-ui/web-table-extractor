import * as cheerio from "cheerio";

export type ExtractedTable = { index: number; headers: string[]; rows: string[][] };

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }

function uniqueHeaders(headers: string[]) {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = clean(header) || `Column ${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} ${count + 1}`;
  });
}

export function extractTables(html: string): ExtractedTable[] {
  const $ = cheerio.load(html);
  const tables: ExtractedTable[] = [];
  $("table").each((tableIndex, tableElement) => {
    const rows: string[][] = [];
    $(tableElement).find("tr").each((_, rowElement) => {
      const cells = $(rowElement).find("th, td").map((_, cell) => clean($(cell).text())).get();
      if (cells.length > 0) rows.push(cells);
    });
    if (rows.length === 0) return;

    const explicitHeader = $(tableElement).find("thead tr").first();
    const headerCells = explicitHeader.find("th, td").map((_, cell) => clean($(cell).text())).get();
    const headers = uniqueHeaders(headerCells.length > 0 ? headerCells : rows[0]);
    const dataRows = headerCells.length > 0 ? rows : rows.slice(1);
    const width = Math.max(headers.length, ...dataRows.map((row) => row.length), 0);
    const normalizedHeaders = uniqueHeaders(Array.from({ length: width }, (_, index) => headers[index] ?? `Column ${index + 1}`));
    const normalizedRows = dataRows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
    tables.push({ index: tableIndex, headers: normalizedHeaders, rows: normalizedRows });
  });
  return tables.sort((a, b) => b.rows.length * b.headers.length - a.rows.length * a.headers.length);
}

export function extractPageTitle(html: string) {
  const $ = cheerio.load(html);
  return clean($("title").first().text());
}
