import { NextResponse } from "next/server";
import { extractPageTitle, extractTables } from "@/lib/extractor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";

    if (!rawUrl) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(rawUrl);
    } catch {
      return NextResponse.json({ error: "Enter a valid URL." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS URLs are supported." },
        { status: 400 }
      );
    }

    const response = await fetch(target, {
      headers: {
        "User-Agent": "WebTableExtractor-API/0.1",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Target site returned HTTP ${response.status}.` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return NextResponse.json(
        { error: "The target URL did not return an HTML page." },
        { status: 415 }
      );
    }

    const html = await response.text();
    const tables = extractTables(html);

    return NextResponse.json({
      success: true,
      sourceUrl: target.toString(),
      pageTitle: extractPageTitle(html),
      tableCount: tables.length,
      tables,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "The target page took too long to respond."
        : "Could not fetch or parse the target page.";

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
