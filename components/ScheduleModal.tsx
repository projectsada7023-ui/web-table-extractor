"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type ScheduleModalProps = {
  open: boolean;
  onClose: () => void;
  sourceUrl: string;
  tableIndex: number;
};

export default function ScheduleModal({ open, onClose, sourceUrl, tableIndex }: ScheduleModalProps) {
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const loadEmail = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? "");
      setMessage("");
    };
    void loadEmail();
  }, [open]);

  if (!open) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ sourceUrl, tableIndex, cadence, email: email.trim() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not save schedule.");
      setMessage("Schedule saved. Your next snapshot will be sent automatically.");
      setTimeout(onClose, 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="profile-modal-backdrop" onMouseDown={onClose}>
      <section className="schedule-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="schedule-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="auth-label">Pro automation</div>
        <h2 id="schedule-title">Schedule extraction</h2>
        <p className="meta">Table {tableIndex + 1} from the current URL will be captured and emailed automatically.</p>
        <form className="schedule-form" onSubmit={save}>
          <label>Cadence</label>
          <div className="schedule-options">
            <button type="button" className={cadence === "daily" ? "schedule-option active" : "schedule-option"} onClick={() => setCadence("daily")}>
              <strong>Daily</strong><span>Every day</span>
            </button>
            <button type="button" className={cadence === "weekly" ? "schedule-option active" : "schedule-option"} onClick={() => setCadence("weekly")}>
              <strong>Weekly</strong><span>Once per week</span>
            </button>
          </div>
          <label>Email destination</label>
          <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          <div className="schedule-source">{sourceUrl}</div>
          <button className="primary" type="submit" disabled={saving}>{saving ? "Saving schedule..." : "Save schedule"}</button>
        </form>
        {message && <div className="auth-message">{message}</div>}
      </section>
    </div>
  );
}
