"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function PlanCard() {
  const [plan, setPlan] = useState<"free" | "pro">("free");

  useEffect(() => {
    let active = true;
    const loadPlan = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user || !active) return;

      const { data } = await supabase
        .from("profiles")
        .select("plan")
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      if (active && data?.plan === "pro") setPlan("pro");
    };

    void loadPlan();
    return () => { active = false; };
  }, []);

  return (
    <div className="panel plan-card">
      <div>
        <div className="eyebrow">Your plan</div>
        <h2>{plan === "pro" ? "Pro plan" : "Free plan"}</h2>
        <p className="meta">
          {plan === "pro"
            ? "Unlimited daily extraction access."
            : "3 successful extractions per day."}
        </p>
      </div>
      {plan === "free" && (
        <button
          className="secondary"
          type="button"
          onClick={() => alert("Pro payments are being connected next. Your Free plan remains active.")}
        >
          Upgrade to Pro
        </button>
      )}
    </div>
  );
}
