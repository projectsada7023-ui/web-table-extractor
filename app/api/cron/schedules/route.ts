import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";
export const maxDuration = 60;

type Schedule = {
  id: string;
  user_id: string;
  source_url: string;
  table_index: number;
  cadence: "daily" | "weekly";
  email: string;
  created_at: string;
  last_run_at: string | null;
};

function csvEscape(value: string) {
  return '"' + value.replaceAll('"', '""') + '"';
}

function isDue(schedule: Schedule, now: Date) {
  if (schedule.cadence === "daily") {
    return !schedule.last_run_at || new Date(schedule.last_run_at).toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
  }

  const createdDay = new Date(schedule.created_at).getUTCDay();
  if (now.getUTCDay() !== createdDay) return false;
  if (!schedule.last_run_at) return true;
  return now.getTime() - new Date(schedule.last_run_at).getTime() >= 6 * 24 * 60 * 60 * 1000;
}

async function fetchSnapshot(sourceUrl: string, tableIndex: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "WebTableExtractor-Scheduler/0.1", Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Target site returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("The target URL did not return an HTML page.");
    }
    const html = await response.text();
    const tables = extractTables(html);
    const table = tables[tableIndex];
    if (!table) throw new Error(`Table ${tableIndex + 1} is no longer available on the page.`);

    const csv = [
      "\ufeff" + table.headers.map(csvEscape).join(","),
      ...table.rows.map((row) => row.map(csvEscape).join(","))
    ].join("\n");

    return { title: extractPageTitle(html), table, csv };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmail(to: string, title: string, sourceUrl: string, csv: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Scheduled email delivery is not configured.");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Web Table Extractor snapshot — ${title || "Extracted table"}`,
      html: `<p>Your scheduled table snapshot is ready.</p><p><strong>Source:</strong> ${sourceUrl}</p><p>The latest CSV is attached.</p>`,
      attachments: [{
        filename: "table-snapshot.csv",
        content: Buffer.from(csv, "utf8").toString("base64"),
        content_type: "text/csv",
      }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email delivery failed: ${body.slice(0, 180)}`);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Scheduler is not configured." }, { status: 500 });

  const supabase = createClient(url, serviceKey);
  const now = new Date();
  const { data: schedules, error } = await supabase
    .from("extraction_schedules")
    .select("id,user_id,source_url,table_index,cadence,email,created_at,last_run_at")
    .eq("active", true);

  if (error) return NextResponse.json({ error: "Could not load schedules." }, { status: 500 });

  let processed = 0;
  let sent = 0;
  const failures: string[] = [];

  for (const rawSchedule of schedules ?? []) {
    const schedule = rawSchedule as Schedule;
    if (!isDue(schedule, now)) continue;
    processed += 1;

    const { data: profile } = await supabase.from("profiles").select("plan").eq("user_id", schedule.user_id).maybeSingle();
    if (profile?.plan !== "pro") continue;

    try {
      const snapshot = await fetchSnapshot(schedule.source_url, schedule.table_index);
      await sendEmail(schedule.email, snapshot.title, schedule.source_url, snapshot.csv);
      await supabase.from("extraction_schedules").update({ last_run_at: now.toISOString(), last_error: null }).eq("id", schedule.id);
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scheduled extraction failed.";
      await supabase.from("extraction_schedules").update({ last_error: message }).eq("id", schedule.id);
      failures.push(`${schedule.id}: ${message}`);
    }
  }

  return NextResponse.json({ success: true, processed, sent, failures });
}
