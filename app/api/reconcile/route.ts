import { NextResponse } from "next/server";
import { parseFile, reconcileTables, reportToCsv, suggestKeys } from "@/lib/reconcile";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 12 * 1024 * 1024;

function fileSummary(fileName: string, headers: string[], rowCount: number) {
  return { fileName, headers, rowCount };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const fileA = form.get("fileA");
    const fileB = form.get("fileB");

    if (!(fileA instanceof File) || !(fileB instanceof File)) {
      return NextResponse.json({ error: "Upload both files before reconciling." }, { status: 400 });
    }
    if (fileA.size > MAX_FILE_BYTES || fileB.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "The MVP accepts files up to 12 MB each. Larger business tiers can be added after the core flow is proven." },
        { status: 413 }
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
    };

    if (!keyA || !keyB) {
      return NextResponse.json({ ...base, needsKeySelection: true });
    }

    const reconciliation = reconcileTables(tableA, tableB, keyA, keyB);
    return NextResponse.json({
      ...base,
      needsKeySelection: false,
      reconciliation,
      discrepancyCsv: reportToCsv(reconciliation.report),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The files could not be reconciled.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
