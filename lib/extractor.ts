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

function rowsMatch(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((cell, index) => clean(cell) === clean(right[index]));
}

export function extractTables(html: string): ExtractedTable[] {
  const $ = cheerio.load(html);
  const tables: ExtractedTable[] = [];

  $("table").each((tableIndex, tableElement) => {
    const allRows: string[][] = [];
    $(tableElement).find("tr").each((_, rowElement) => {
      const cells = $(rowElement).find("th, td").map((_, cell) => clean($(cell).text())).get();
      if (cells.length > 0) allRows.push(cells);
    });
    if (allRows.length === 0) return;

    const explicitHeader = $(tableElement).find("thead tr").first();
    const headerCells = explicitHeader.find("th, td").map((_, cell) => clean($(cell).text())).get();
    const hasExplicitHeader = headerCells.length > 0;

    const headers = uniqueHeaders(hasExplicitHeader ? headerCells : allRows[0]);

    let dataRows: string[][];

    if (hasExplicitHeader) {
      // Prefer tbody so <thead> rows can never leak into the data array.
      const bodyRows: string[][] = [];
      $(tableElement).find("tbody tr").each((_, rowElement) => {
        const cells = $(rowElement).find("th, td").map((_, cell) => clean($(cell).text())).get();
        if (cells.length > 0) bodyRows.push(cells);
      });

      dataRows = bodyRows.length > 0
        ? bodyRows
        : allRows.filter((row) => !rowsMatch(row, headerCells));
    } else {
      dataRows = allRows.slice(1);
    }

    // Defensive guard for malformed tables that duplicate the header as
    // the first data row even when the HTML structure is not clean.
    if (dataRows.length > 0 && rowsMatch(dataRows[0], headerCells.length > 0 ? headerCells : allRows[0])) {
      dataRows = dataRows.slice(1);
    }

    const width = Math.max(headers.length, ...dataRows.map((row) => row.length), 0);
    const normalizedHeaders = uniqueHeaders(
      Array.from({ length: width }, (_, index) => headers[index] ?? `Column ${index + 1}`)
    );
    const normalizedRows = dataRows.map((row) =>
      Array.from({ length: width }, (_, index) => row[index] ?? "")
    );

    tables.push({ index: tableIndex, headers: normalizedHeaders, rows: normalizedRows });
  });

  return tables.sort((a, b) => b.rows.length * b.headers.length - a.rows.length * a.headers.length);
}

export function extractPageTitle(html: string) {
  const $ = cheerio.load(html);
  return clean($("title").first().text());
}
