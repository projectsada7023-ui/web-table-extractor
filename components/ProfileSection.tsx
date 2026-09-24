"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Profile = {
  full_name: string | null;
  age: number | null;
  plan: "free" | "pro";
  plan_started_at: string | null;
  plan_current_period_end: string | null;
  plan_amount: number | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function ProfileSection() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [onboarding, setOnboarding] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const supabase = getSupabaseBrowserClient();
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;
    setEmail(session.session.user.email ?? "");
    const { data } = await supabase.from("profiles").select("full_name,age,plan,plan_started_at,plan_current_period_end,plan_amount").eq("user_id", session.session.user.id).maybeSingle();
    if (data) {
      const next = data as Profile;
      setProfile(next);
      setName(next.full_name ?? "");
      setAge(next.age ? String(next.age) : "");
      if (!next.full_name) setOnboarding(true);
    }
  }

  useEffect(() => {
    void load();
    const supabase = getSupabaseBrowserClient();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void load());
    return () => listener.subscription.unsubscribe();
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    const numericAge = Number(age);
    if (!name.trim() || !Number.isInteger(numericAge) || numericAge < 1 || numericAge > 120) {
      setMessage("Please enter your name and a valid age.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) throw new Error("Please sign in again.");
      const { error } = await supabase.from("profiles").update({ full_name: name.trim(), age: numericAge }).eq("user_id", session.session.user.id);
      if (error) throw error;
      await load();
      setOnboarding(false);
      setOpen(false);
      setMessage("Profile updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  return (
    <>
      <button className="profile-button" type="button" onClick={() => { setMessage(""); setOpen(true); }}>
        Profile
      </button>

      {open && (
        <div className="profile-modal-backdrop" onMouseDown={() => !onboarding && setOpen(false)}>
          <section className="profile-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            {!onboarding && <button className="modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>}
            <div className="auth-label">{onboarding ? "Complete your profile" : "Your profile"}</div>
            <h2>{onboarding ? "Tell us about yourself" : (profile.full_name || "Your profile")}</h2>
            <p className="meta">{onboarding ? "Add these details once to finish setting up your account." : "Your account and subscription details."}</p>

            <form className="profile-form" onSubmit={save}>
              <label>Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required />
              <label>Age</label>
              <input className="input" type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Your age" required />
              <label>Email</label>
              <input className="input profile-readonly" value={email} readOnly />
              <button className="primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save profile"}</button>
            </form>

            {!onboarding && (
              <div className="profile-details">
                <div><span>Plan</span><strong>{profile.plan === "pro" ? "Pro · Unlimited" : "Free · 3/day"}</strong></div>
                <div><span>Plan start date</span><strong>{formatDate(profile.plan_started_at)}</strong></div>
                <div><span>Plan end date</span><strong>{profile.plan === "pro" ? formatDate(profile.plan_current_period_end) : "—"}</strong></div>
                <div><span>Plan amount</span><strong>{profile.plan === "pro" ? "₹199 / month" : "₹0"}</strong></div>
              </div>
            )}
            {message && <div className="auth-message">{message}</div>}
          </section>
        </div>
      )}
    </>
  );
}
