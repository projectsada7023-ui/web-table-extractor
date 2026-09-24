export type CleanTable = { headers: string[]; rows: string[][] };

export function trimWhitespace(table: CleanTable): CleanTable {
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  return {
    headers: table.headers.map(clean),
    rows: table.rows.map((row) => row.map(clean)),
  };
}

export function removeEmptyRowsAndColumns(table: CleanTable): CleanTable {
  const isEmpty = (value: string) => !value.trim();
  const keptRows = table.rows.filter((row) => row.some((cell) => !isEmpty(cell)));
  const width = table.headers.length;
  const keepColumns = Array.from({ length: width }, (_, columnIndex) =>
    table.headers[columnIndex].trim() !== "" ||
    keptRows.some((row) => !isEmpty(row[columnIndex] ?? ""))
  );

  return {
    headers: table.headers.filter((_, index) => keepColumns[index]),
    rows: keptRows.map((row) => row.filter((_, index) => keepColumns[index])),
  };
}

function parseNumber(value: string): string {
  const raw = value.trim();
  if (!raw) return raw;

  const negative = /^\(.*\)$/.test(raw);
  const normalized = raw
    .replace(/[₹$€£,]/g, "")
    .replace(/\b(?:rs\.?|inr|usd|eur|gbp)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const crore = /\bcr(?:ore|ores)?\b/i.test(normalized);
  const lakh = /\bl(?:akh|acs?)\b/i.test(normalized);
  const million = /\bm(?:illion)?\b/i.test(normalized);
  const billion = /\bb(?:illion)?\b/i.test(normalized);

  const match = normalized.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) return value.trim();

  let number = Number(match[0]);
  if (!Number.isFinite(number)) return value.trim();
  if (crore) number *= 10_000_000;
  else if (lakh) number *= 100_000;
  else if (million) number *= 1_000_000;
  else if (billion) number *= 1_000_000_000;
  if (negative) number = -Math.abs(number);

  return Number.isInteger(number) ? String(number) : String(Number(number.toFixed(6)));
}

export function formatNumbers(table: CleanTable): CleanTable {
  const looksNumeric = (value: string) =>
    /(?:₹|rs\.?|inr|usd|eur|gbp|\bcr(?:ore|ores)?\b|\bl(?:akh|lacs?)\b|\bmillion\b|\bbillion\b|^[\s()\-+\d,.]+$)/i.test(value.trim());

  return {
    headers: table.headers,
    rows: table.rows.map((row) => row.map((cell) => looksNumeric(cell) ? parseNumber(cell) : cell)),
  };
}
