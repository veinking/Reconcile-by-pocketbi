import { createClient } from "@supabase/supabase-js";

export type OptionalCapabilityCheck =
  | { ok: true; authenticated: false; allowed: false }
  | { ok: true; authenticated: true; allowed: boolean; userId: string }
  | { ok: false; status: number; error: string };

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  return { url, key };
}

export async function checkOptionalCapability(request: Request, capability: string): Promise<OptionalCapabilityCheck> {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) return { ok: true, authenticated: false, allowed: false };

  const { url, key } = config();
  if (!url || !key) {
    return { ok: false, status: 503, error: "PocketBI identity service is not configured." };
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) {
    return { ok: false, status: 401, error: "The PocketBI token is invalid or expired." };
  }

  const { data: allowed, error: entitlementError } = await client.rpc("has_entitlement", {
    p_capability: capability,
  });

  if (entitlementError) {
    console.error("[Reconcile] entitlement check failed", entitlementError.message);
    return { ok: false, status: 503, error: "PocketBI access could not be verified." };
  }

  return { ok: true, authenticated: true, allowed: allowed === true, userId: user.id };
}
