import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function getPaymentConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!keyId || !keySecret || !planId || !webhookSecret || !supabaseUrl || !serviceRoleKey) throw new Error("Payment system is not configured.");
  return { keyId, keySecret, planId, webhookSecret, supabaseUrl, serviceRoleKey };
}
export function getServiceSupabase() {
  const c = getPaymentConfig();
  return createClient(c.supabaseUrl, c.serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
export function razorpayAuthHeader(keyId: string, keySecret: string) {
  return "Basic " + Buffer.from(keyId + ":" + keySecret).toString("base64");
}
export function signHmacSha256(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}
export function safeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
