"use client";

import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type EntitlementRow = { capability: string; value: unknown; ends_at: string | null };

type PocketBIContextValue = {
  client: SupabaseClient | null;
  session: Session | null;
  loading: boolean;
  entitlementError: boolean;
  hasCapability: (capability: string) => boolean;
  refreshEntitlements: () => Promise<void>;
};

const PocketBIContext = createContext<PocketBIContextValue | null>(null);

function makeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || url.includes("YOUR-POCKETBI-PROJECT") || key.includes("YOUR_POCKETBI")) return null;
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
}

function enabled(value: unknown): boolean {
  if (value === true || value === 1 || value === "true") return true;
  if (value && typeof value === "object" && "enabled" in value) return (value as { enabled?: unknown }).enabled === true;
  return false;
}

export function PocketBIProvider({ children }: { children: ReactNode }) {
  const client = useMemo(() => makeClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [entitlementError, setEntitlementError] = useState(false);
  const [loading, setLoading] = useState(Boolean(client));

  async function load(nextSession: Session | null) {
    setSession(nextSession);
    setEntitlementError(false);
    if (!client || !nextSession) { setEntitlements([]); return; }
    const { data, error } = await client.rpc("get_my_entitlements");
    if (error) { setEntitlements([]); setEntitlementError(true); return; }
    setEntitlements((data || []) as EntitlementRow[]);
  }

  useEffect(() => {
    if (!client) { setLoading(false); return; }
    let active = true;
    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      await load(data.session);
      if (active) setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => { void load(nextSession); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [client]);

  const hasCapability = (capability: string) => entitlements.some((row) => row.capability === capability && enabled(row.value));
  const refreshEntitlements = async () => load(session);

  return (
    <PocketBIContext.Provider value={{ client, session, loading, entitlementError, hasCapability, refreshEntitlements }}>
      {children}
    </PocketBIContext.Provider>
  );
}

export function usePocketBI() {
  const value = useContext(PocketBIContext);
  if (!value) throw new Error("usePocketBI must be used inside PocketBIProvider");
  return value;
}
