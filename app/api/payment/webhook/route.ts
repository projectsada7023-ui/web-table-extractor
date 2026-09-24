import { NextResponse } from "next/server";
import { getPaymentConfig, getServiceSupabase, safeEqualHex, signHmacSha256 } from "@/lib/razorpay-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const config = getPaymentConfig();
    if (!safeEqualHex(signHmacSha256(rawBody, config.webhookSecret), signature)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });

    const event = JSON.parse(rawBody);
    const subscription = event?.payload?.subscription?.entity;
    const userId = subscription?.notes?.user_id;
    if (!subscription?.id || !userId) return NextResponse.json({ received: true });

    const activeEvents = new Set(["subscription.activated", "subscription.charged", "subscription.resumed"]);
    const inactiveEvents = new Set(["subscription.cancelled", "subscription.halted", "subscription.completed"]);
    const update: Record<string, unknown> = {
      razorpay_subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
    };

    if (activeEvents.has(event.event)) {
      update.plan = "pro";
      update.plan_amount = 19900;
      if (!update.plan_started_at) update.plan_started_at = new Date().toISOString();
      update.plan_status = subscription.status ?? "active";
      if (subscription.current_end) update.plan_current_period_end = new Date(subscription.current_end * 1000).toISOString();
    } else if (inactiveEvents.has(event.event)) {
      update.plan = "free";
      update.plan_status = subscription.status ?? "inactive";
    } else {
      return NextResponse.json({ received: true });
    }

    const { error } = await getServiceSupabase().from("profiles").update(update).eq("user_id", userId);
    if (error) return NextResponse.json({ error: "Could not update subscription state." }, { status: 500 });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 400 });
  }
}
