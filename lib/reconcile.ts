import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedTable = {
  fileName: string;
  headers: string[];
  rows: string[][];
};

export type KeySuggestion = {
  keyA: string;
  keyB: string;
  score: number;
  reason: string;
};

export type NumericDiscrepancy = {
  column: string;
  comparedPairs: number;
  changedPairs: number;
  netDelta: number;
  absoluteDelta: number;
};

export type ReconcileSummary = {
  rowsA: number;
  rowsB: number;
  matched: number;
  changed: number;
  onlyA: number;
  onlyB: number;
  duplicateKeyValuesA: number;
  duplicateKeyValuesB: number;
  missingKeysA: number;
  missingKeysB: number;
  sharedColumns: number;
  matchRate: number;
};

export type ReconcileResult = {
  summary: ReconcileSummary;
  report: Record<string, string>[];
  numericDiscrepancies: NumericDiscrepancy[];
};

function text(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function canonicalHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function compareValue(value: string): string {
  return value.trim();
}

function parseNumeric(value: string): number | null {
  let raw = value.trim();
  if (!raw) return null;
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  raw = raw.replace(/[$,\s]/g, "").replace(/%$/, "");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

export function parseFile(buffer: Buffer, fileName: string): ParsedTable {
  const lower = fileName.toLowerCase();
  let matrix: unknown[][];

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new Error("The workbook has no sheets.");
    matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[firstSheet], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    }) as unknown[][];
  } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const parsed = Papa.parse<string[]>(buffer.toString("utf8"), { skipEmptyLines: false });
    if (parsed.errors.length && !parsed.data.length) {
      throw new Error(parsed.errors[0]?.message || "The file could not be parsed.");
    }
    matrix = parsed.data;
  } else {
    throw new Error("Reconcile currently accepts CSV, TXT, XLS, and XLSX files.");
  }

  if (!matrix.length) throw new Error("The file is empty.");

  const headers = (matrix[0] ?? []).map((value, index) => {
    const cleaned = text(value).replace(/^\uFEFF/, "").trim();
    return cleaned || `Column ${index + 1}`;
  });
  if (!headers.length) throw new Error("The file has no columns.");

  const rows = matrix.slice(1).map((row) =>
    Array.from({ length: headers.length }, (_, index) => text(row[index] ?? ""))
  );

  return { fileName, headers, rows };
}

function keyStats(table: ParsedTable, index: number) {
  const values = table.rows.map((row) => normalizeKey(row[index] ?? "")).filter(Boolean);
  const unique = new Set(values);
  const total = Math.max(1, table.rows.length);
  return {
    fillRate: values.length / total,
    uniqueness: values.length ? unique.size / values.length : 0,
  };
}

export function suggestKeys(a: ParsedTable, b: ParsedTable): KeySuggestion[] {
  const suggestions: KeySuggestion[] = [];

  a.headers.forEach((headerA, indexA) => {
    const canonicalA = canonicalHeader(headerA);
    if (!canonicalA) return;

    b.headers.forEach((headerB, indexB) => {
      if (canonicalA !== canonicalHeader(headerB)) return;
      const statsA = keyStats(a, indexA);
      const statsB = keyStats(b, indexB);
      const score = Math.round(
        100 *
          (0.55 * Math.min(statsA.uniqueness, statsB.uniqueness) +
            0.35 * Math.min(statsA.fillRate, statsB.fillRate) +
            0.1)
      );
      suggestions.push({
        keyA: headerA,
        keyB: headerB,
        score,
        reason: `${Math.round(Math.min(statsA.uniqueness, statsB.uniqueness) * 100)}% minimum uniqueness · matching header name`,
      });
    });
  });

  return suggestions.sort((left, right) => right.score - left.score).slice(0, 6);
}

function columnUnion(a: ParsedTable, b: ParsedTable) {
  const union = new Map<
    string,
    { canonical: string; label: string; aIndex?: number; bIndex?: number }
  >();

  a.headers.forEach((header, index) => {
    const canonical = canonicalHeader(header) || `a_${index}`;
    if (!union.has(canonical)) union.set(canonical, { canonical, label: header, aIndex: index });
  });

  b.headers.forEach((header, index) => {
    const canonical = canonicalHeader(header) || `b_${index}`;
    const current = union.get(canonical);
    if (current) current.bIndex = index;
    else union.set(canonical, { canonical, label: header, bIndex: index });
  });

  return [...union.values()];
}

export function reconcileTables(
  a: ParsedTable,
  b: ParsedTable,
  keyA: string,
  keyB: string
): ReconcileResult {
  const keyIndexA = a.headers.indexOf(keyA);
  const keyIndexB = b.headers.indexOf(keyB);
  if (keyIndexA < 0 || keyIndexB < 0) throw new Error("The selected match key no longer exists in one of the files.");

  type IndexedRow = { displayKey: string; row: string[]; rowNumber: number };
  const indexA = new Map<string, IndexedRow[]>();
  const indexB = new Map<string, IndexedRow[]>();
  const missingA: IndexedRow[] = [];
  const missingB: IndexedRow[] = [];

  const addRows = (
    table: ParsedTable,
    keyIndex: number,
    target: Map<string, IndexedRow[]>,
    missing: IndexedRow[]
  ) => {
    table.rows.forEach((row, rowOffset) => {
      const rawKey = row[keyIndex] ?? "";
      const normalized = normalizeKey(rawKey);
      const item = { displayKey: rawKey.trim(), row, rowNumber: rowOffset + 2 };
      if (!normalized) {
        missing.push(item);
        return;
      }
      target.set(normalized, [...(target.get(normalized) ?? []), item]);
    });
  };

  addRows(a, keyIndexA, indexA, missingA);
  addRows(b, keyIndexB, indexB, missingB);

  const columns = columnUnion(a, b);
  const sharedColumns = columns.filter(
    (column) => column.aIndex !== undefined && column.bIndex !== undefined
  );
  const compareColumns = sharedColumns.filter(
    (column) => column.aIndex !== keyIndexA && column.bIndex !== keyIndexB
  );

  const report: Record<string, string>[] = [];
  let matched = 0;
  let changed = 0;
  let onlyA = 0;
  let onlyB = 0;

  const numeric = new Map<
    string,
    { column: string; comparedPairs: number; changedPairs: number; netDelta: number; absoluteDelta: number }
  >();

  const makeReportRow = (
    status: string,
    key: string,
    changedColumns: string,
    rowA?: string[],
    rowB?: string[],
    note = ""
  ) => {
    const output: Record<string, string> = {
      status,
      key,
      changed_columns: changedColumns,
      note,
    };
    columns.forEach((column) => {
      output[`A · ${column.label}`] = column.aIndex === undefined || !rowA ? "" : rowA[column.aIndex] ?? "";
      output[`B · ${column.label}`] = column.bIndex === undefined || !rowB ? "" : rowB[column.bIndex] ?? "";
    });
    return output;
  };

  const allKeys = new Set([...indexA.keys(), ...indexB.keys()]);

  allKeys.forEach((normalizedKey) => {
    const rowsA = indexA.get(normalizedKey) ?? [];
    const rowsB = indexB.get(normalizedKey) ?? [];
    const displayKey = rowsA[0]?.displayKey || rowsB[0]?.displayKey || normalizedKey;

    if (!rowsA.length) {
      onlyB++;
      report.push(makeReportRow("only_in_b", displayKey, "", undefined, rowsB[0]?.row));
      return;
    }
    if (!rowsB.length) {
      onlyA++;
      report.push(makeReportRow("only_in_a", displayKey, "", rowsA[0]?.row, undefined));
      return;
    }
    if (rowsA.length > 1 || rowsB.length > 1) {
      report.push(
        makeReportRow(
          "duplicate_key",
          displayKey,
          "",
          rowsA[0]?.row,
          rowsB[0]?.row,
          `A has ${rowsA.length} row(s); B has ${rowsB.length} row(s). Resolve duplicate keys before one-to-one comparison.`
        )
      );
      return;
    }

    const rowA = rowsA[0].row;
    const rowB = rowsB[0].row;
    const changedLabels: string[] = [];

    compareColumns.forEach((column) => {
      const valueA = rowA[column.aIndex!] ?? "";
      const valueB = rowB[column.bIndex!] ?? "";
      if (compareValue(valueA) !== compareValue(valueB)) changedLabels.push(column.label);

      const numberA = parseNumeric(valueA);
      const numberB = parseNumeric(valueB);
      if (numberA !== null && numberB !== null) {
        const current = numeric.get(column.canonical) ?? {
          column: column.label,
          comparedPairs: 0,
          changedPairs: 0,
          netDelta: 0,
          absoluteDelta: 0,
        };
        current.comparedPairs++;
        const delta = numberB - numberA;
        if (delta !== 0) {
          current.changedPairs++;
          current.netDelta += delta;
          current.absoluteDelta += Math.abs(delta);
        }
        numeric.set(column.canonical, current);
      }
    });

    if (!changedLabels.length) {
      matched++;
      return;
    }

    changed++;
    report.push(makeReportRow("changed", displayKey, changedLabels.join(", "), rowA, rowB));
  });

  missingA.forEach((item) => {
    report.push(
      makeReportRow(
        "missing_key_a",
        `(blank key · row ${item.rowNumber})`,
        "",
        item.row,
        undefined,
        `The ${keyA} value is blank in file A.`
      )
    );
  });
  missingB.forEach((item) => {
    report.push(
      makeReportRow(
        "missing_key_b",
        `(blank key · row ${item.rowNumber})`,
        "",
        undefined,
        item.row,
        `The ${keyB} value is blank in file B.`
      )
    );
  });

  const duplicateKeyValuesA = [...indexA.values()].filter((rows) => rows.length > 1).length;
  const duplicateKeyValuesB = [...indexB.values()].filter((rows) => rows.length > 1).length;
  const comparable = matched + changed + onlyA + onlyB;

  return {
    summary: {
      rowsA: a.rows.length,
      rowsB: b.rows.length,
      matched,
      changed,
      onlyA,
      onlyB,
      duplicateKeyValuesA,
      duplicateKeyValuesB,
      missingKeysA: missingA.length,
      missingKeysB: missingB.length,
      sharedColumns: sharedColumns.length,
      matchRate: comparable ? Math.round((matched / comparable) * 1000) / 10 : 0,
    },
    report,
    numericDiscrepancies: [...numeric.values()]
      .filter((item) => item.changedPairs > 0)
      .sort((left, right) => right.absoluteDelta - left.absoluteDelta)
      .slice(0, 8),
  };
}

export function reportToCsv(report: Record<string, string>[]): string {
  if (!report.length) return "status,key,changed_columns,note\n";
  return Papa.unparse(report);
}
