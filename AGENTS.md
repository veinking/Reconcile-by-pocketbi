# PocketBI Reconcile guardrails

- Keep the core flow fast: two files → key confirmation → discrepancy result → download.
- Never require AI for deterministic reconciliation.
- Never persist uploaded business files unless a future feature explicitly requires it and the user has clear notice/control.
- Shared PocketBI identity must not imply shared product data. Reconcile data stays isolated from other PocketBI products by default.
- Model paid access through entitlements/credits, not hard-coded plan-name checks.
- Keep `main` production-ready. Development branches should not create unnecessary Vercel preview churn.
- Prefer evidence in the result: show exactly which records/fields differ rather than vague AI explanations.
