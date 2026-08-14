# PocketBI Reconcile

**Upload two business files. Find what does not match.**

PocketBI Reconcile is a focused reconciliation tool in the PocketBI ecosystem. It compares two CSV/Excel exports, identifies missing and changed records, flags duplicate keys, and produces a downloadable discrepancy report.

## MVP

- CSV, TXT, XLS, and XLSX input
- automatic match-key suggestions
- manual key selection for each file
- matched / changed / only-in-A / only-in-B counts
- duplicate-key and missing-key detection
- field-level change detection
- numeric discrepancy summaries
- downloadable discrepancy CSV
- in-memory processing with no intentional file persistence in the MVP
- no account required for the first-use flow

## PocketBI ecosystem direction

Reconcile is designed to participate in a shared **PocketBI ID**: one account, centralized membership/entitlements, and product-specific private data. Identity can be shared without sharing Reconcile files with other PocketBI products.

See [`docs/POCKETBI_ID.md`](docs/POCKETBI_ID.md) for the integration contract we should preserve as the ecosystem grows.

## Product principle

**Clean → Reconcile → Analyze → Report.**

PocketClean fixes incoming data. Reconcile verifies that two systems or exports agree. PocketBI analyzes the result.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Current status

This repository contains the first functional Reconcile MVP. Billing and PocketBI ID are intentionally not required for the initial test flow; those should be layered on after the reconciliation experience is proven.
