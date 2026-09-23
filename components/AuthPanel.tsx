"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export default function AuthPanel() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = getClient();
    setClient(supabase);

    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!client) {
      setMessage("Supabase is not configured in the deployment yet.");
      return;
    }

    if (!email.trim() || !password) {
      setMessage("Enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created and signed in.");
        } else {
          setMessage("Account created. Check your email to confirm your account.");
        }
      } else {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
        setMessage("Signed in successfully.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    if (!client) return;
    await client.auth.signOut();
    setMessage("Signed out.");
  }

  if (userEmail) {
    return (
      <section className="auth-panel">
        <div>
          <div className="auth-label">Account</div>
          <strong>{userEmail}</strong>
        </div>
        <button className="secondary" onClick={logout} type="button">
          Logout
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel">
      <div className="auth-copy">
        <div className="auth-label">Account</div>
        <h2>{mode === "login" ? "Sign in" : "Create an account"}</h2>
        <p>Free plan includes 3 extractions per day.</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <input
          className="input"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
        />
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
        <button className="primary" disabled={loading} type="submit">
          {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        className="auth-switch"
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
        }}
      >
        {mode === "login" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>

      {message && <div className="auth-message">{message}</div>}
    </section>
  );
}
