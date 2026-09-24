import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getPaymentConfig, getServiceSupabase, safeEqualHex, signHmacSha256 } from "@/lib/razorpay-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
    const authClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: "Bearer " + token } } });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });

    const body = await request.json();
    const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const subscriptionId = typeof body?.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
    const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";
    if (!paymentId || !subscriptionId || !signature) return NextResponse.json({ error: "Incomplete Razorpay payment response." }, { status: 400 });

    const config = getPaymentConfig();
    const expected = signHmacSha256(paymentId + "|" + subscriptionId, config.keySecret);
    if (!safeEqualHex(expected, signature)) return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });

    const service = getServiceSupabase();
    const { error } = await service.from("profiles").update({
      plan: "pro", plan_status: "active", razorpay_subscription_id: subscriptionId, plan_started_at: new Date().toISOString(), plan_amount: 19900, updated_at: new Date().toISOString()
    }).eq("user_id", userData.user.id);
    if (error) return NextResponse.json({ error: "Payment verified, but your Pro plan could not be activated automatically." }, { status: 500 });

    return NextResponse.json({ success: true, plan: "pro" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not verify payment." }, { status: 500 });
  }
}
