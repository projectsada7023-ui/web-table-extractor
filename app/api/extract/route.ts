import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";

const DAILY_LIMIT = 3;

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" ||
    host.endsWith(".localhost") || host.startsWith("10.") || host.startsWith("192.168.") ||
    host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") ||
    host.startsWith("172.19.") || host.startsWith("169.254.");
}

function getSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");

  return createClient(url, key, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function startOfTodayIso() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) {
      return NextResponse.json({ error: "Please sign in before extracting." }, { status: 401 });
    }

    const supabase = getSupabase(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
    }

    const { count, error: countError } = await supabase
      .from("extraction_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userData.user.id)
      .eq("status", "success")
      .gte("created_at", startOfTodayIso());

    if (countError) {
      console.error("Usage limit check failed:", countError.message);
      return NextResponse.json({ error: "Could not check your daily usage limit." }, { status: 500 });
    }

    const usedToday = count ?? 0;
    if (usedToday >= DAILY_LIMIT) {
      return NextResponse.json({
        error: "Daily free limit reached. You have used all 3 extractions for today. Your limit resets tomorrow.",
        code: "DAILY_LIMIT_REACHED",
        usedToday,
        dailyLimit: DAILY_LIMIT,
        remainingToday: 0,
      }, { status: 429 });
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
        headers: {
          "User-Agent": "WebTableExtractor/0.1",
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "follow",
        cache: "no-store",
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok)
      return NextResponse.json({ error: `Target site returned HTTP ${response.status}.` }, { status: 502 });

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml"))
      return NextResponse.json({ error: "The target URL did not return an HTML page." }, { status: 415 });

    const html = await response.text();
    const tables = extractTables(html);

    const { error: usageError } = await supabase.rpc("record_extraction_usage", {
      p_source_url: target.toString(),
      p_table_count: tables.length,
    });

    if (usageError) {
      console.error("Usage tracking failed:", usageError.message);
      return NextResponse.json({ error: "Extraction succeeded, but usage could not be recorded." }, { status: 500 });
    }

    const newUsedToday = usedToday + 1;
    return NextResponse.json({
      url: target.toString(),
      title: extractPageTitle(html),
      tables,
      usedToday: newUsedToday,
      dailyLimit: DAILY_LIMIT,
      remainingToday: Math.max(DAILY_LIMIT - newUsedToday, 0),
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The target page took too long to respond."
      : error instanceof Error && error.message === "Supabase is not configured."
        ? error.message
        : "Could not fetch or parse the target page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
