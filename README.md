# web-table-extractor

Autonomous web and table data extraction engine that converts messy web tables into structured JSON, CSV, and Excel data.

## Developer API

### Endpoint

`POST /api/v1/extract`

Full endpoint:

`https://web-table-extractor.vercel.app/api/v1/extract`

### Request

Send JSON with a `url` field:

```json
{
  "url": "https://www.w3schools.com/html/html_tables.asp"
}
```

### Response

The API returns structured JSON containing the source URL, page title, table count, and extracted tables.

```json
{
  "success": true,
  "sourceUrl": "https://www.w3schools.com/html/html_tables.asp",
  "pageTitle": "HTML Tables",
  "tableCount": 2,
  "tables": []
}
```

### Example with curl

```bash
curl -X POST "https://web-table-extractor.vercel.app/api/v1/extract" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.w3schools.com/html/html_tables.asp"}'
```

> The developer API is currently separate from the signed-in dashboard quota. Authentication, rate limiting, and stronger SSRF protection for the developer API remain production-hardening tasks.

## Supabase authentication

The dashboard includes Supabase email/password authentication.

Configure these environment variables in Vercel (and locally if needed):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Do not use or expose a Supabase secret/service-role key in the browser.

The current authentication layer supports sign up, sign in, session detection, and logout.

## Free plan usage limit

The signed-in dashboard currently allows **3 successful extractions per user per day**.

Usage is recorded in the `public.extraction_usage` table. The quota is enforced by the Supabase `record_extraction_usage` RPC so concurrent requests cannot consume the same remaining slot.

The product day is calculated using **Asia/Kolkata (IST)**.

The production quota SQL is stored at:

`supabase/migrations/202609240001_production_daily_quota.sql`

Run that SQL once in the Supabase SQL Editor after pulling the latest project code.
