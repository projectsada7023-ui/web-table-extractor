import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } } });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Please sign in before scheduling an extraction." }, { status: 401 });
    }

    const token = authorization.slice(7);
    const supabase = getSupabase(token);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: "Could not check your account plan." }, { status: 500 });
    if (profile?.plan !== "pro") {
      return NextResponse.json({ error: "Scheduled extraction is available on Pro only." }, { status: 403 });
    }

    const body = await request.json();
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : "";
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const tableIndex = Number(body?.tableIndex);
    const cadence = body?.cadence === "weekly" ? "weekly" : body?.cadence === "daily" ? "daily" : "";

    let parsedUrl: URL;
    try { parsedUrl = new URL(sourceUrl); }
    catch { return NextResponse.json({ error: "Enter a valid source URL." }, { status: 400 }); }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: "Only HTTP and HTTPS URLs are supported." }, { status: 400 });
    }
    if (!Number.isInteger(tableIndex) || tableIndex < 0) {
      return NextResponse.json({ error: "Invalid table selection." }, { status: 400 });
    }
    if (!cadence) return NextResponse.json({ error: "Choose Daily or Weekly." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email destination." }, { status: 400 });
    }

    const { data, error } = await supabase.from("extraction_schedules").insert({
      user_id: userData.user.id,
      source_url: parsedUrl.toString(),
      table_index: tableIndex,
      cadence,
      email,
      active: true,
    }).select("id,cadence,email,source_url,table_index,created_at").single();

    if (error) return NextResponse.json({ error: "Could not save your schedule." }, { status: 500 });
    return NextResponse.json({ success: true, schedule: data });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Could not save schedule."
    }, { status: 500 });
  }
}
