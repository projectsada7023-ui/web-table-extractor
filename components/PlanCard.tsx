"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function PlanCard() {
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const loadPlan = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.user || !active) return;
      const { data } = await supabase.from("profiles").select("plan").eq("user_id", sessionData.session.user.id).maybeSingle();
      if (active && data?.plan === "pro") setPlan("pro");
    };
    void loadPlan();
    return () => { active = false; };
  }, []);

  async function upgrade() {
    setLoading(true);
    setMessage("");
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in before upgrading.");

      const response = await fetch("/api/payment/create-subscription", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not start payment.");

      if (!window.Razorpay) {
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Could not load Razorpay Checkout."));
          document.body.appendChild(script);
        });
      }
      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

      const razorpay = new window.Razorpay({
        key: payload.keyId,
        subscription_id: payload.subscriptionId,
        name: payload.name,
        description: payload.description,
        prefill: { email: payload.email },
        theme: { color: "#2563eb" },
        handler: async (payment: Record<string, string>) => {
          const verifyResponse = await fetch("/api/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
            body: JSON.stringify(payment),
          });
          const verifyPayload = await verifyResponse.json();
          if (!verifyResponse.ok) throw new Error(verifyPayload.error ?? "Payment verification failed.");
          setPlan("pro");
          setMessage("Payment verified. Your Pro plan is now active.");
        },
      });
      razorpay.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel plan-card">
      <div>
        <div className="eyebrow">Your plan</div>
        <h2>{plan === "pro" ? "Pro plan" : "Free plan"}</h2>
        <p className="meta">{plan === "pro" ? "Unlimited daily extraction access." : "3 successful extractions per day."}</p>
        {message && <p className="meta">{message}</p>}
      </div>
      {plan === "free" && (
        <button className="secondary" type="button" onClick={upgrade} disabled={loading}>
          {loading ? "Opening payment..." : "Upgrade to Pro — ₹199/month"}
        </button>
      )}
    </div>
  );
}
