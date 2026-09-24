import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";
const DAILY_LIMIT = 3;

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" ||
    host.endsWith(".localhost") || host.startsWith("10.") || host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) || host.startsWith("169.254.");
}

function getSupabase(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

function startOfTodayIso() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const isGuest = !token;
    let supabase: ReturnType<typeof getSupabase> | null = null;
    let plan: "free" | "pro" = "free";
    let usedToday = 0;

    if (!isGuest) {
      supabase = getSupabase(token);
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("plan").eq("user_id", userData.user.id).maybeSingle();
      if (profileError) return NextResponse.json({ error: "Could not check your account plan." }, { status: 500 });

      plan = profile?.plan === "pro" ? "pro" : "free";
      const { count, error: countError } = await supabase
        .from("extraction_usage").select("id", { count: "exact", head: true })
        .eq("user_id", userData.user.id).eq("status", "success").gte("created_at", startOfTodayIso());
      if (countError) return NextResponse.json({ error: "Could not check your daily usage limit." }, { status: 500 });

      usedToday = count ?? 0;
      if (plan === "free" && usedToday >= DAILY_LIMIT) {
        return NextResponse.json({
          error: "Daily free limit reached. You have used all 3 extractions for today. Your limit resets tomorrow.",
          code: "DAILY_LIMIT_REACHED", plan, usedToday, dailyLimit: DAILY_LIMIT, remainingToday: 0
        }, { status: 429 });
      }
    } else {
      const guestUsed = Number(request.headers.get("x-guest-extractions") ?? "0");
      if (guestUsed >= DAILY_LIMIT) {
        return NextResponse.json({
          error: "You've used your 3 free guest extractions. Create a free account to continue.",
          code: "GUEST_LIMIT_REACHED", plan: "free", usedToday: DAILY_LIMIT, dailyLimit: DAILY_LIMIT, remainingToday: 0
        }, { status: 429 });
      }
      usedToday = guestUsed;
    }

    const body = await request.json();
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ error: "URL is required." }, { status: 400 });

    let target: URL;
    try { target = new URL(rawUrl); }
    catch { return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 }); }

    if (!["http:", "https:"].includes(target.protocol))
      return NextResponse.json({ error: "Only HTTP and HTTPS URLs are supported." }, { status: 400 });
    if (isBlockedHost(target.hostname))
      return NextResponse.json({ error: "This host is not allowed." }, { status: 400 });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(target, {
        signal: controller.signal,
        headers: { "User-Agent": "WebTableExtractor/0.1", Accept: "text/html,application/xhtml+xml" },
        redirect: "follow", cache: "no-store"
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) return NextResponse.json({ error: `Target site returned HTTP ${response.status}.` }, { status: 502 });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml"))
      return NextResponse.json({ error: "The target URL did not return an HTML page." }, { status: 415 });

    const html = await response.text();
    const tables = extractTables(html);
    if (supabase) {
      const { error: usageError } = await supabase.rpc("record_extraction_usage", {
        p_source_url: target.toString(), p_table_count: tables.length
      });
      if (usageError) return NextResponse.json({ error: "Extraction succeeded, but usage could not be recorded." }, { status: 500 });
    }

    const newUsedToday = usedToday + 1;
    return NextResponse.json({
      url: target.toString(), title: extractPageTitle(html), tables, plan,
      usedToday: newUsedToday,
      dailyLimit: plan === "pro" ? null : DAILY_LIMIT,
      remainingToday: plan === "pro" ? null : Math.max(DAILY_LIMIT - newUsedToday, 0)
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The target page took too long to respond."
      : error instanceof Error && error.message === "Supabase is not configured."
        ? error.message : "Could not fetch or parse the target page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
