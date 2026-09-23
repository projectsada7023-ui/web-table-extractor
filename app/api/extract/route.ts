import { NextResponse } from "next/server";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";

function isBlockedHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" ||
    host.endsWith(".localhost") || host.startsWith("10.") || host.startsWith("192.168.") ||
    host.startsWith("172.16.") || host.startsWith("172.17.") || host.startsWith("172.18.") ||
    host.startsWith("172.19.") || host.startsWith("169.254.");
}

export async function POST(request: Request) {
  try {
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
    return NextResponse.json({ url: target.toString(), title: extractPageTitle(html), tables: extractTables(html) });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "The target page took too long to respond."
      : "Could not fetch or parse the target page.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
