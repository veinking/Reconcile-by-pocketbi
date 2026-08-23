"use client";

import { FormEvent, useState } from "react";
import { usePocketBI } from "./PocketBIProvider";
import styles from "./PocketBIAccount.module.css";

const POCKETBI_ACCOUNT_HOME = "https://pocketbi.app/account";

export default function PocketBIAccount() {
  const { client, session, loading, entitlementError, hasCapability } = usePocketBI();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  if (!client) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!client || busy) return;

    if (mode === "signup" && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setOpen(false);
        setPassword("");
        setConfirmPassword("");
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
          setConfirmPassword("");
        } else {
          setMessage("PocketBI ID created. Check your email if confirmation is required, then return here and sign in to Reconcile with that same ID.");
          setPassword("");
          setConfirmPassword("");
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

  function switchMode() {
    setMode((current) => current === "signin" ? "signup" : "signin");
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  }

  const membershipLabel = entitlementError
    ? "PocketBI access unavailable"
    : loading
      ? "Checking PocketBI access…"
      : hasCapability("reconcile.full_export")
        ? "PocketBI Pro"
        : "PocketBI Free";

  return (
    <div className={styles.accountShell}>
      {session ? (
        <div className={styles.signedIn}>
          <div><span>{membershipLabel} · Reconcile session</span><strong>{session.user.email || "PocketBI ID"}</strong></div>
          <a className={styles.accountHomeLink} href={POCKETBI_ACCOUNT_HOME} target="_blank" rel="noreferrer">PocketBI Home ↗</a>
          <button type="button" onClick={signOut} disabled={busy}>Sign out here</button>
        </div>
      ) : (
        <button className={styles.accountButton} type="button" onClick={() => setOpen(true)}>
          <span className={styles.dot} /> Connect PocketBI ID
        </button>
      )}

      {open && !session && (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-label="PocketBI account">
            <button className={styles.close} type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <p className={styles.eyebrow}>PocketBI ID · Reconcile</p>
            <h2>{mode === "signin" ? "Connect your PocketBI ID here." : "Create one PocketBI ID."}</h2>
            <p className={styles.copy}>This signs the current Reconcile browser into your shared PocketBI identity. The account is shared across the ecosystem; separate web domains do not automatically share a browser session yet. Reconcile files and reports stay separate unless you explicitly move them between tools.</p>
            <form onSubmit={submit}>
              <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required /></label>
              {mode === "signup" && (
                <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} required /></label>
              )}
              {message && <div className={styles.message}>{message}</div>}
              <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Working…" : mode === "signin" ? "Sign in to Reconcile" : "Create PocketBI ID"}</button>
            </form>
            <button className={styles.switcher} type="button" onClick={switchMode}>
              {mode === "signin" ? "New to PocketBI? Create an account" : "Already have a PocketBI ID? Sign in here"}
            </button>
            <a className={styles.accountHomeDialogLink} href={POCKETBI_ACCOUNT_HOME} target="_blank" rel="noreferrer">Open PocketBI Account Home ↗</a>
          </section>
        </div>
      )}
    </div>
  );
}
