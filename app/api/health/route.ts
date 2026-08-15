import { NextResponse } from "next/server";

const EXPECTED_POCKETBI_PROJECT = "bozkwngfioubgwzvzfif";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const publicKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  ).trim();

  let projectRef = "";
  try {
    projectRef = new URL(url).hostname.split(".")[0] || "";
  } catch {}

  const identityConfigured = Boolean(url && publicKey);
  const identityAuthorityCorrect = projectRef === EXPECTED_POCKETBI_PROJECT;
  const healthy = identityConfigured && identityAuthorityCorrect;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "pocketbi-reconcile",
      identityConfigured,
      identityAuthorityCorrect,
      identityProjectRef: projectRef || null,
      exportCapability: "reconcile.full_export",
      checkedAt: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
