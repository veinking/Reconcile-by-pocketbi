import { NextResponse } from "next/server";
import { parseFile, reconcileTables, reportToCsv, suggestKeys } from "@/lib/reconcile";
import { checkOptionalCapability } from "@/lib/pocketbiServerAuth";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 12 * 1024 * 1024;
const EXPORT_CAPABILITY = "reconcile.full_export";
const FREE_PREVIEW_ROWS = 10;

function fileSummary(fileName: string, headers: string[], rowCount: number) {
  return { fileName, headers, rowCount };
}

export async function POST(request: Request) {
  try {
    const access = await checkOptionalCapability(request, EXPORT_CAPABILITY);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const form = await request.formData();
    const fileA = form.get("fileA");
    const fileB = form.get("fileB");

    if (!(fileA instanceof File) || !(fileB instanceof File)) {
      return NextResponse.json({ error: "Upload both files before reconciling." }, { status: 400 });
    }
    if (fileA.size > MAX_FILE_BYTES || fileB.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "The MVP accepts files up to 12 MB each." },
        { status: 413 },
      );
    }

    const [bufferA, bufferB] = await Promise.all([
      fileA.arrayBuffer().then((value) => Buffer.from(value)),
      fileB.arrayBuffer().then((value) => Buffer.from(value)),
    ]);

    const tableA = parseFile(bufferA, fileA.name);
    const tableB = parseFile(bufferB, fileB.name);
    const suggestions = suggestKeys(tableA, tableB);

    const requestedKeyA = String(form.get("keyA") ?? "").trim();
    const requestedKeyB = String(form.get("keyB") ?? "").trim();
    const automatic = suggestions[0];
    const keyA = requestedKeyA || automatic?.keyA || "";
    const keyB = requestedKeyB || automatic?.keyB || "";

    const base = {
      files: {
        a: fileSummary(tableA.fileName, tableA.headers, tableA.rows.length),
        b: fileSummary(tableB.fileName, tableB.headers, tableB.rows.length),
      },
      suggestions,
      selectedKey: keyA && keyB ? { keyA, keyB, automatic: !requestedKeyA && !requestedKeyB } : null,
      exportAccess: access.allowed,
    };

    if (!keyA || !keyB) {
      return NextResponse.json({ ...base, needsKeySelection: true });
    }

    const reconciliation = reconcileTables(tableA, tableB, keyA, keyB);
    const report = access.allowed
      ? reconciliation.report
      : reconciliation.report.slice(0, FREE_PREVIEW_ROWS);

    return NextResponse.json({
      ...base,
      needsKeySelection: false,
      reconciliation: { ...reconciliation, report },
      discrepancyCsv: access.allowed ? reportToCsv(reconciliation.report) : undefined,
      previewLimited: !access.allowed && reconciliation.report.length > FREE_PREVIEW_ROWS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The files could not be reconciled.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
