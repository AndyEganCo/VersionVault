# Launch Newsletter — Freemium + Free Month of Pro

This is the one-off newsletter that announces the freemium launch and the
1-month Pro gift. Send this **today**, before the winddown cron (which starts
tomorrow) fires, so users aren't hit with two emails on day one.

## How to send

Use the existing `send-custom-newsletter` edge function. From the admin UI
(`/admin/custom-newsletter`) paste the subject and HTML body below and send
to `all`, OR invoke the function directly:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-custom-newsletter" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d @scripts/launch-newsletter-payload.json
```

Send to `test` first (your own email) to verify rendering, then run with
`recipientType: "all"`.

## Subject

`VersionVault just got a free tier — and you get 1 month of Pro on us`

## HTML body

The HTML lives in `scripts/launch-newsletter-body.html` to keep this file
readable. Paste its contents into the newsletter `content` field.
