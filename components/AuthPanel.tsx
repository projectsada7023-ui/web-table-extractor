"use client";

import { FormEvent, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

function getClient() {
  try { return getSupabaseBrowserClient(); } catch { return null; }
}

export default function AuthPanel() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = getClient();
    setClient(supabase);
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    const openAuth = (event: Event) => {
      const requested = (event as CustomEvent<"login" | "signup">).detail;
      setMode(requested === "signup" ? "signup" : "login");
      setMessage("");
      setOpen(true);
    };
    window.addEventListener("open-auth", openAuth);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("open-auth", openAuth);
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!client) { setMessage("Supabase is not configured in the deployment yet."); return; }
    if (!email.trim() || !password) { setMessage("Enter your email and password."); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setMessage(data.session ? "Account created and signed in." : "Account created. Check your email to confirm your account.");
      } else {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage("Signed in successfully.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally { setLoading(false); }
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    setMessage("Signed out.");
  }

  function openAuth(nextMode: "login" | "signup") {
    setMode(nextMode);
    setMessage("");
    setOpen(true);
  }

  return (
    <>
      <header className="site-header">
        <button className="brand" type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="brand-mark">W</span>
          <span className="brand-copy">
            <strong>Autonomous Web Data Extractor</strong>
            <small>Clean data from the web</small>
          </span>
        </button>
        <nav className="header-actions" aria-label="Account">
          {userEmail ? (
            <>
              <span className="account-pill" title={userEmail}>
                <span className="account-dot" />
                <span>{userEmail}</span>
              </span>
              <button className="header-ghost" type="button" onClick={logout}>Log out</button>
            </>
          ) : (
            <>
              <button className="header-ghost" type="button" onClick={() => openAuth("login")}>Sign in</button>
              <button className="header-cta" type="button" onClick={() => openAuth("signup")}>Sign up</button>
            </>
          )}
        </nav>
      </header>

      {open && (
        <div className="auth-modal-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
            <div className="modal-brand">
              <span className="brand-mark">W</span>
            </div>
            <div className="auth-modal-heading">
              <div className="auth-label">Web Table Extractor</div>
              <h2 id="auth-title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
              <p>{mode === "login" ? "Sign in to continue extracting and keep your usage synced." : "Create a free account and get 3 extractions every day."}</p>
            </div>
            <form className="auth-modal-form" onSubmit={submit}>
              <label>Email address</label>
              <input className="input" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
              <label>Password</label>
              <input className="input" type="password" placeholder="Your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              <button className="primary auth-submit" disabled={loading} type="submit">
                {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"}
              </button>
            </form>
            {message && <div className="auth-message">{message}</div>}
            <button className="auth-switch" type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>
              {mode === "login" ? "New here? Create a free account" : "Already have an account? Sign in"}
            </button>
            <div className="auth-trust">No credit card required · Free plan includes 3 daily extractions</div>
          </section>
        </div>
      )}
    </>
  );
}
