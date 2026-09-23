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

> API authentication, rate limiting, and stronger SSRF protection are planned for a later production-hardening phase.
