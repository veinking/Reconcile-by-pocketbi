"use client";

import { ChangeEvent, useMemo, useState } from "react";
import EntitledDownloadButton from "./components/EntitledDownloadButton";
import { usePocketBI } from "./components/PocketBIProvider";

type FileSummary = { fileName: string; headers: string[]; rowCount: number };
type KeySuggestion = { keyA: string; keyB: string; score: number; reason: string };
type Summary = {
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
type NumericDiscrepancy = {
  column: string;
  comparedPairs: number;
  changedPairs: number;
  netDelta: number;
  absoluteDelta: number;
};
type ApiResult = {
  files: { a: FileSummary; b: FileSummary };
  suggestions: KeySuggestion[];
  selectedKey: { keyA: string; keyB: string; automatic: boolean } | null;
  needsKeySelection: boolean;
  exportAccess: boolean;
  previewLimited?: boolean;
  reconciliation?: {
    summary: Summary;
    report: Record<string, string>[];
    numericDiscrepancies: NumericDiscrepancy[];
  };
  discrepancyCsv?: string;
};

const ACCEPT = ".csv,.txt,.xls,.xlsx";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function FilePicker({ label, hint, file, onChange }: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.files?.[0] ?? null);
  return (
    <label className={`file-card ${file ? "has-file" : ""}`}>
      <input type="file" accept={ACCEPT} onChange={handle} />
      <span className="file-badge">{label}</span>
      <strong>{file ? file.name : "Choose a CSV or Excel file"}</strong>
      <span className="file-hint">{file ? `${formatNumber(file.size / 1024)} KB ready` : hint}</span>
      <span className="file-action">{file ? "Replace file" : "Browse file"}</span>
    </label>
  );
}

export default function Home() {
  const { session } = usePocketBI();
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [keyA, setKeyA] = useState("");
  const [keyB, setKeyB] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = Boolean(fileA && fileB && !loading);
  const summary = result?.reconciliation?.summary;
  const preview = useMemo(() => result?.reconciliation?.report.slice(0, 10) ?? [], [result]);

  function resetForFile(side: "a" | "b", file: File | null) {
    if (side === "a") setFileA(file);
    else setFileB(file);
    setResult(null);
    setKeyA("");
    setKeyB("");
    setError("");
  }

  async function analyze() {
    if (!fileA || !fileB) return;
    setLoading(true);
    setError("");

    try {
      const form = new FormData();
      form.append("fileA", fileA);
      form.append("fileB", fileB);
      if (keyA) form.append("keyA", keyA);
      if (keyB) form.append("keyB", keyB);

      const headers = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined;
      const response = await fetch("/api/reconcile", { method: "POST", body: form, headers });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Reconciliation failed.");

      const next = payload as ApiResult;
      setResult(next);
      if (next.selectedKey) {
        setKeyA(next.selectedKey.keyA);
        setKeyB(next.selectedKey.keyB);
      } else {
        setKeyA((current) => current || next.files.a.headers[0] || "");
        setKeyB((current) => current || next.files.b.headers[0] || "");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reconciliation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <div className="wrap nav">
          <a className="brand" href="https://pocketbi.app" aria-label="PocketBI home">
            <span className="brand-mark">PB</span>
            <span><strong>PocketBI</strong><small>Reconcile</small></span>
          </a>
          <div className="nav-note">Business data utilities · PocketBI ecosystem</div>
        </div>
      </header>

      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <p className="eyebrow">PocketBI Reconcile</p>
            <h1>Find what <span>doesn&apos;t match.</span></h1>
            <p className="hero-copy">Drop in two business exports. Reconcile identifies missing records, changed values, duplicate keys, and numeric discrepancies—then gives you a clean report to act on.</p>
            <div className="trust-row"><span>CSV + Excel</span><span>No account required</span><span>Deterministic comparison</span><span>12 MB per file</span></div>
          </div>
          <div className="hero-panel">
            <div className="mini-head"><span>RECONCILIATION</span><span className="online">● READY</span></div>
            <div className="flow"><div>FILE A</div><b>↔</b><div>FILE B</div></div>
            <div className="mini-stats"><span><strong>Missing</strong> records</span><span><strong>Changed</strong> values</span><span><strong>Duplicate</strong> keys</span></div>
          </div>
        </div>
      </section>

      <section className="wrap workspace" aria-live="polite">
        <div className="section-heading">
          <div><p className="eyebrow">Compare</p><h2>Two files. One answer.</h2></div>
          <p>Use the field that uniquely identifies the same record in both files—customer ID, invoice number, SKU, employee ID, or another stable key.</p>
        </div>

        <div className="upload-grid">
          <FilePicker label="A" hint="Your source, expected, or earlier export" file={fileA} onChange={(file) => resetForFile("a", file)} />
          <FilePicker label="B" hint="Your destination, actual, or newer export" file={fileB} onChange={(file) => resetForFile("b", file)} />
        </div>

        {result && (
          <div className="key-panel">
            <div><span className="panel-label">Match records using</span>{result.selectedKey?.automatic && <span className="auto-chip">Auto-suggested</span>}</div>
            <div className="key-grid">
              <label>File A key<select value={keyA} onChange={(event) => setKeyA(event.target.value)}>{result.files.a.headers.map((header) => <option key={`a-${header}`} value={header}>{header}</option>)}</select></label>
              <div className="equals">=</div>
              <label>File B key<select value={keyB} onChange={(event) => setKeyB(event.target.value)}>{result.files.b.headers.map((header) => <option key={`b-${header}`} value={header}>{header}</option>)}</select></label>
            </div>
            {result.suggestions[0] && <p className="suggestion">Top suggestion confidence: {result.suggestions[0].score}/100 · {result.suggestions[0].reason}</p>}
          </div>
        )}

        {error && <div className="error">{error}</div>}

        <div className="run-row">
          <button className="primary" disabled={!canAnalyze} onClick={analyze}>{loading ? "Comparing files…" : result ? "Re-run comparison" : "Compare files"}</button>
          <p>Uploads are processed for this request. The MVP does not intentionally persist your files.</p>
        </div>
      </section>

      {summary && result?.reconciliation && (
        <section className="wrap results">
          <div className="result-title">
            <div><p className="eyebrow">Result</p><h2>{summary.matchRate}% record match rate</h2></div>
            <EntitledDownloadButton csv={result.discrepancyCsv} />
          </div>

          <div className="score-grid">
            <div className="score-card good"><span>Matched</span><strong>{formatNumber(summary.matched)}</strong><small>same key + same shared values</small></div>
            <div className="score-card warn"><span>Changed</span><strong>{formatNumber(summary.changed)}</strong><small>same key, different values</small></div>
            <div className="score-card"><span>Only in A</span><strong>{formatNumber(summary.onlyA)}</strong><small>missing from file B</small></div>
            <div className="score-card"><span>Only in B</span><strong>{formatNumber(summary.onlyB)}</strong><small>new or missing from file A</small></div>
          </div>

          <div className="quality-strip">
            <span><b>{summary.duplicateKeyValuesA}</b> duplicate keys in A</span>
            <span><b>{summary.duplicateKeyValuesB}</b> duplicate keys in B</span>
            <span><b>{summary.missingKeysA + summary.missingKeysB}</b> rows missing keys</span>
            <span><b>{summary.sharedColumns}</b> shared columns</span>
          </div>

          {result.previewLimited && (
            <div className="error">Free preview is limited to the first 10 discrepancies. PocketBI Pro unlocks the complete report and CSV export.</div>
          )}

          {result.reconciliation.numericDiscrepancies.length > 0 && (
            <div className="result-card">
              <div className="card-head"><div><p className="panel-label">Numeric differences</p><h3>Where totals move</h3></div><span>File B − File A</span></div>
              <div className="numeric-list">
                {result.reconciliation.numericDiscrepancies.map((item) => (
                  <div className="numeric-row" key={item.column}>
                    <strong>{item.column}</strong>
                    <span>{item.changedPairs} changed pair{item.changedPairs === 1 ? "" : "s"}</span>
                    <span>Net {item.netDelta >= 0 ? "+" : ""}{formatNumber(item.netDelta)}</span>
                    <span>Absolute {formatNumber(item.absoluteDelta)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="result-card">
            <div className="card-head"><div><p className="panel-label">Discrepancy preview</p><h3>{formatNumber(preview.length)} shown</h3></div><span>{result.previewLimited ? "Free preview" : "Complete access"}</span></div>
            {preview.length ? (
              <div className="table-wrap"><table><thead><tr><th>Status</th><th>Key</th><th>Changed fields</th><th>Note</th></tr></thead><tbody>
                {preview.map((row, index) => <tr key={`${row.key}-${index}`}><td><span className={`status status-${row.status}`}>{statusLabel(row.status)}</span></td><td>{row.key}</td><td>{row.changed_columns || "—"}</td><td>{row.note || "—"}</td></tr>)}
              </tbody></table></div>
            ) : <div className="perfect">No discrepancies found for the selected key and shared columns.</div>}
          </div>
        </section>
      )}

      <section className="wrap next-step">
        <div><p className="eyebrow">PocketBI workflow</p><h2>Clean → Reconcile → Analyze.</h2><p>PocketClean prepares recurring business files. Reconcile verifies that systems agree. PocketBI turns the result into analysis and reporting.</p></div>
        <a href="https://pocketbi.app">Explore PocketBI</a>
      </section>

      <footer><div className="wrap"><span>© 2026 PocketBI</span><span>support@proairesume.com</span></div></footer>
    </main>
  );
}
