import { NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;
const DAILY_LIMIT = 3;

const MAX_REDIRECTS = 5;
const GUEST_COOKIE = "wte_guest_id";

function isBlockedIp(address: string) {
  const ip = address.toLowerCase();
  const mappedIpv4 = ip.match(/^::ffff:(\\d+\\.\\d+\\.\\d+\\.\\d+)$/);
  if (mappedIpv4) return isBlockedIp(mappedIpv4[1]);

  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (isIP(ip) === 6) {
    return (
      ip === "::" ||
      ip === "::1" ||
      ip.startsWith("fc") ||
      ip.startsWith("fd") ||
      ip.startsWith("fe8") ||
      ip.startsWith("fe9") ||
      ip.startsWith("fea") ||
      ip.startsWith("feb")
    );
  }

  return true;
}

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || isBlockedIp(host);
}

async function assertPublicTarget(target: URL) {
  if (isBlockedHost(target.hostname)) throw new Error("This host is not allowed.");

  const records = await lookup(target.hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isBlockedIp(record.address))) {
    throw new Error("This host is not allowed.");
  }
}

function getSupabase(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key);
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
      usedToday = 0;
    }

    const body = await request.json();
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!rawUrl) return NextResponse.json({ error: "URL is required." }, { status: 400 });

    let target: URL;
    try { target = new URL(rawUrl); }
    catch { return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 }); }

    if (!["http:", "https:"].includes(target.protocol))
      return NextResponse.json({ error: "Only HTTP and HTTPS URLs are supported." }, { status: 400 });

    try {
      await assertPublicTarget(target);
    } catch (error) {
      if (error instanceof Error && error.message === "This host is not allowed.") {
        return NextResponse.json({ error: "This host is not allowed." }, { status: 400 });
      }
      return NextResponse.json({ error: "Could not verify the target host." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    let response: Response;
    let finalUrl = target;

    try {
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        response = await fetch(finalUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "WebTableExtractor/0.1", Accept: "text/html,application/xhtml+xml" },
          redirect: "manual", cache: "no-store"
        });

        if (![301, 302, 303, 307, 308].includes(response.status)) break;

        if (redirectCount === MAX_REDIRECTS) {
          return NextResponse.json({ error: "Too many redirects from the target website." }, { status: 502 });
        }

        const location = response.headers.get("location");
        if (!location) return NextResponse.json({ error: "The target website returned an invalid redirect." }, { status: 502 });

        let redirectedUrl: URL;
        try {
          redirectedUrl = new URL(location, finalUrl);
        } catch {
          return NextResponse.json({ error: "The target website returned an invalid redirect." }, { status: 502 });
        }

        if (!["http:", "https:"].includes(redirectedUrl.protocol)) {
          return NextResponse.json({ error: "Redirects to non-HTTP URLs are not allowed." }, { status: 400 });
        }

        try {
          await assertPublicTarget(redirectedUrl);
        } catch (error) {
          if (error instanceof Error && error.message === "This host is not allowed.") {
            return NextResponse.json({ error: "The redirect target is not allowed." }, { status: 400 });
          }
          return NextResponse.json({ error: "Could not verify the redirect target." }, { status: 400 });
        }

        finalUrl = redirectedUrl;
      }
    } finally {
      clearTimeout(timeout);
    }

    if (!response!) return NextResponse.json({ error: "Could not fetch the target page." }, { status: 502 });
    if (!response.ok) return NextResponse.json({ error: `Target site returned HTTP ${response.status}.` }, { status: 502 });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml"))
      return NextResponse.json({ error: "The target URL did not return an HTML page." }, { status: 415 });

    const html = await response.text();
    const tables = extractTables(html);

    if (supabase) {
      const { error: usageError } = await supabase.rpc("record_extraction_usage", {
        p_source_url: finalUrl.toString(), p_table_count: tables.length
      });
      if (usageError) return NextResponse.json({ error: "Extraction succeeded, but usage could not be recorded." }, { status: 500 });
    }

    let newUsedToday = usedToday + 1;
    const result = NextResponse.json({
      url: finalUrl.toString(), title: extractPageTitle(html), tables, plan,
      usedToday: newUsedToday,
      dailyLimit: plan === "pro" ? null : DAILY_LIMIT,
      remainingToday: plan === "pro" ? null : Math.max(DAILY_LIMIT - newUsedToday, 0)
    });

    if (isGuest) {
      const existingGuestId = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${GUEST_COOKIE}=([^;]+)`))?.[1];
      const guestId = existingGuestId ?? crypto.randomUUID();
      const guestSupabase = getServiceSupabase();
      const { data: consumed, error: guestUsageError } = await guestSupabase.rpc("consume_guest_extraction", {
        p_guest_id: guestId
      });

      if (guestUsageError) {
        if (guestUsageError.message?.includes("Guest daily limit reached")) {
          return NextResponse.json({
            error: "You've used your 3 free guest extractions. Create a free account to continue.",
            code: "GUEST_LIMIT_REACHED",
            plan: "free",
            usedToday: DAILY_LIMIT,
            dailyLimit: DAILY_LIMIT,
            remainingToday: 0
          }, { status: 429 });
        }
        return NextResponse.json({ error: "Could not record your guest usage." }, { status: 500 });
      }

      newUsedToday = Number(consumed ?? 0);
      result.cookies.set({
        name: GUEST_COOKIE,
        value: guestId,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365
      });

      const finalPayload = {
        url: finalUrl.toString(), title: extractPageTitle(html), tables, plan,
        usedToday: newUsedToday,
        dailyLimit: DAILY_LIMIT,
        remainingToday: Math.max(DAILY_LIMIT - newUsedToday, 0)
      };
      return NextResponse.json(finalPayload, { headers: result.headers });
    }

    return result;
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The target website is too large or slow to respond. Please try a different URL."
      : error instanceof Error && error.message === "Supabase is not configured."
        ? error.message : "Could not fetch or parse the target page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
