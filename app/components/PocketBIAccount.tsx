"use client";

import { createClient, Session, SupabaseClient } from "@supabase/supabase-js";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./PocketBIAccount.module.css";

type EntitlementRow = { capability: string; value: unknown; ends_at: string | null };

function makeClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  if (!url || !key || url.includes("YOUR-POCKETBI-PROJECT") || key.includes("YOUR_POCKETBI")) return null;
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

function entitlementEnabled(value: unknown): boolean {
  if (value === true || value === 1 || value === "true") return true;
  if (value && typeof value === "object" && "enabled" in value) {
    return (value as { enabled?: unknown }).enabled === true;
  }
  return false;
}

export default function PocketBIAccount() {
  const client = useMemo(() => makeClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [entitlements, setEntitlements] = useState<EntitlementRow[]>([]);
  const [entitlementsReady, setEntitlementsReady] = useState(false);
  const [entitlementError, setEntitlementError] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!client) return;
    const supabase = client;

    async function sync(nextSession: Session | null) {
      setSession(nextSession);
      setEntitlementError(false);
      if (!nextSession) {
        setEntitlements([]);
        setEntitlementsReady(true);
        return;
      }

      setEntitlementsReady(false);
      const { data, error } = await supabase.rpc("get_my_entitlements");
      if (error) {
        setEntitlements([]);
        setEntitlementError(true);
      } else {
        setEntitlements((data || []) as EntitlementRow[]);
      }
      setEntitlementsReady(true);
    }

    supabase.auth.getSession().then(({ data }) => { void sync(data.session); });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => { void sync(nextSession); });
    return () => data.subscription.unsubscribe();
  }, [client]);

  if (!client) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;
    setBusy(true);
    setMessage("");
    try {
      if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setOpen(false);
        setPassword("");
      } else {
        const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
        });
        if (error) throw error;
        if (data.session) {
          setOpen(false);
          setPassword("");
        } else {
          setMessage("Account created. Check your email if confirmation is required, then sign in with the same PocketBI ID anywhere in the ecosystem.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PocketBI ID could not complete that request.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!client || busy) return;
    setBusy(true);
    await client.auth.signOut();
    setBusy(false);
  }

  const emailLabel = session?.user.email || "PocketBI ID";
  const hasFullReconcile = entitlements.some((row) => row.capability === "reconcile.full_export" && entitlementEnabled(row.value));
  const membershipLabel = entitlementError
    ? "PocketBI access unavailable"
    : !entitlementsReady
      ? "Checking PocketBI access…"
      : hasFullReconcile
        ? "PocketBI Pro"
        : "PocketBI Free";

  return (
    <div className={styles.accountShell}>
      {session ? (
        <div className={styles.signedIn}>
          <div><span>{membershipLabel}</span><strong>{emailLabel}</strong></div>
          <button type="button" onClick={signOut} disabled={busy}>Sign out</button>
        </div>
      ) : (
        <button className={styles.accountButton} type="button" onClick={() => setOpen(true)}>
          <span className={styles.dot} /> PocketBI ID
        </button>
      )}

      {open && !session && (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="PocketBI account">
            <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <p className={styles.eyebrow}>PocketBI ID</p>
            <h2>{mode === "signin" ? "Use your PocketBI account." : "Create one PocketBI account."}</h2>
            <p className={styles.copy}>The same identity can be used across PocketBI products. Reconcile files and product data stay separate unless you explicitly move something between tools.</p>
            <form onSubmit={submit}>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required /></label>
              {message && <div className={styles.message}>{message}</div>}
              <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in" : "Create PocketBI ID"}</button>
            </form>
            <button className={styles.switcher} type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>
              {mode === "signin" ? "New to PocketBI? Create an account" : "Already have PocketBI ID? Sign in"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
