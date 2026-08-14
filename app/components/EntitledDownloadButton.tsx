"use client";

import { usePocketBI } from "./PocketBIProvider";

export default function EntitledDownloadButton({ csv }: { csv?: string }) {
  const { client, session, loading, entitlementError, hasCapability } = usePocketBI();
  const allowed = Boolean(client && session && !entitlementError && hasCapability("reconcile.full_export"));

  function download() {
    if (!csv || !allowed) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "pocketbi-reconcile-discrepancies.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <button className="secondary" disabled>Checking export access…</button>;
  if (!allowed) {
    const label = entitlementError ? "Export access unavailable" : session ? "PocketBI Pro required for full export" : "Sign in for full export";
    return <button className="secondary" disabled={!allowed}>{label}</button>;
  }
  return <button className="secondary" onClick={download}>Download discrepancy CSV</button>;
}
