# PocketBI Reconcile production deployment

Reconcile is intentionally deployed as an independent Next.js service so its server-side `reconcile.full_export` entitlement boundary remains authoritative.

## Vercel import

Import the GitHub repository `veinking/Reconcile-by-pocketbi` into the same Vercel team as PocketBI.

Use the repository root with the Next.js framework preset. The root `vercel.json` keeps automated deployments disabled for `agent/**`, `chore/**`, `codex/**`, and `feat/**`; `main` remains the production branch.

## Required public environment

Set these for Production and Preview:

```text
NEXT_PUBLIC_SUPABASE_URL=https://bozkwngfioubgwzvzfif.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<active public key from the same PocketBI platform project>
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` remains a compatibility fallback when the project only has a legacy anon key.

Never add a Supabase service-role key to this app. Reconcile validates the user's bearer token and calls `has_entitlement()` under that user's authorization context.

## Release verification

After the first production deployment:

1. `GET /api/health` must return HTTP 200 with:
   - `status: "ok"`
   - `identityConfigured: true`
   - `identityAuthorityCorrect: true`
   - `identityProjectRef: "bozkwngfioubgwzvzfif"`
2. Guest comparison must work without signing in and return at most the first 10 discrepancy rows when the complete report is larger.
3. Guest response must not include `discrepancyCsv`.
4. A PocketBI account with `reconcile.full_export` must receive the complete report and CSV export.
5. An invalid or expired bearer token must return 401 rather than falling back to guest access.
6. Confirm no Vercel runtime errors after the smoke test.

## Public routing

Once the deployment is verified, update the PocketBI service hub from `Launch pending` to the verified production URL. A PocketBI-branded custom domain can be attached after the project exists; do not point the hub at an unverified deployment.
