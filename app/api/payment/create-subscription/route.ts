import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPaymentConfig, razorpayAuthHeader } from "@/lib/razorpay-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });

    const { data: profile, error: profileError } = await supabase.from("profiles")
      .select("plan, razorpay_subscription_id").eq("user_id", userData.user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: "Could not check your account plan." }, { status: 500 });
    if (profile?.plan === "pro" && profile.razorpay_subscription_id) return NextResponse.json({ error: "Your account is already on Pro." }, { status: 409 });

    const config = getPaymentConfig();
    const razorpayResponse = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: { Authorization: razorpayAuthHeader(config.keyId, config.keySecret), "Content-Type": "application/json" },
      body: JSON.stringify({
        plan_id: config.planId,
        total_count: 120,
        quantity: 1,
        customer_notify: 1,
        notes: { user_id: userData.user.id, product: "Web Table Extractor Pro", price: "199 INR/month" }
      }),
      cache: "no-store",
    });
    const payload = await razorpayResponse.json();
    if (!razorpayResponse.ok) return NextResponse.json({ error: payload?.error?.description ?? "Razorpay could not create the subscription." }, { status: 502 });

    return NextResponse.json({
      keyId: config.keyId, subscriptionId: payload.id, amount: 19900, currency: "INR",
      name: "Web Table Extractor", description: "Pro plan — ₹199/month", email: userData.user.email ?? ""
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start the subscription." }, { status: 500 });
  }
}
