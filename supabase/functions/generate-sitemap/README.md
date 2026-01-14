# Generate Sitemap Edge Function

This Supabase Edge Function generates a dynamic sitemap.xml that includes all software entries from the database.

## Purpose

The dynamic sitemap helps Google discover and index:
- All main pages (homepage, software, premium, donate, legal pages)
- All software entries (as hash-based links to /software page)

## Deployment

Deploy this function using:

```bash
supabase functions deploy generate-sitemap
```

## Usage

Once deployed, the sitemap will be available at:

```
https://[your-project-ref].supabase.co/functions/v1/generate-sitemap
```

## Integration with robots.txt

You can either:

### Option 1: Use Dynamic Sitemap Only

Update `public/robots.txt` to point to the dynamic sitemap:

```
Sitemap: https://[your-project-ref].supabase.co/functions/v1/generate-sitemap
```

### Option 2: Use Both Static and Dynamic

Keep the static sitemap for main pages and add a software-specific sitemap:

```
Sitemap: https://versionvault.dev/sitemap.xml
Sitemap: https://[your-project-ref].supabase.co/functions/v1/generate-sitemap
```

## Caching

The function includes a 1-hour cache header to reduce load:
- `Cache-Control: public, max-age=3600`

## Testing

Test the function locally:

```bash
supabase functions serve generate-sitemap
```

Then visit: `http://localhost:54321/functions/v1/generate-sitemap`

## Notes

- Software entries use hash-based URLs (`/software#software-name`) since the app uses modals instead of individual pages
- This still helps Google understand your content and may improve SEO
- The sitemap updates automatically as software is added/updated in the database
