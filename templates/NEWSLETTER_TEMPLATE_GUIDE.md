# VersionVault Newsletter Template for Resend

This template can be uploaded to Resend and used to send manual newsletters with custom content.

## Template File

📄 **File:** `resend-newsletter-template.html`

## How to Upload to Resend

1. Log in to your [Resend Dashboard](https://resend.com/emails)
2. Navigate to **Emails** → **Templates** (or go to https://resend.com/templates)
3. Click **Create Template**
4. Give it a name (e.g., "VersionVault Newsletter")
5. Copy the contents of `resend-newsletter-template.html` and paste it into the template editor
6. Save the template

## Available Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{newsletter_title}}` | Email subject/title | "Product Updates" |
| `{{newsletter_type}}` | Type of newsletter shown in header | "Monthly Newsletter" |
| `{{user_name}}` | Recipient's name | "Andy" |
| `{{intro_text}}` | Opening paragraph text | "Here's what's new this month..." |
| `{{main_content}}` | Main body content (HTML allowed) | See examples below |

### Optional Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{user_id}}` | User ID for unsubscribe links | "user_123" |
| `{{feature_highlight}}` | Enable feature box (true/false) | true |
| `{{feature_title}}` | Feature box title | "New Dashboard" |
| `{{feature_description}}` | Feature box description | "Check out our redesigned dashboard..." |
| `{{feature_link}}` | Feature box link URL | "https://versionvault.dev/dashboard" |
| `{{feature_cta_text}}` | Feature box button text | "Try It Now" |
| `{{notice_text}}` | Enable notice box (set to text) | "Maintenance scheduled..." |
| `{{notice_title}}` | Notice box title | "Important" or "Heads Up" |
| `{{cta_button}}` | Enable main CTA button (true/false) | true |
| `{{cta_text}}` | Main CTA button text | "View Full Update" |
| `{{cta_link}}` | Main CTA button URL | "https://versionvault.dev/blog" |
| `{{sponsor_name}}` | Sponsor name | "Acme Corp" |
| `{{sponsor_tagline}}` | Sponsor tagline | "Better Software Tools" |
| `{{sponsor_description}}` | Sponsor description | "Acme helps teams..." |
| `{{sponsor_link}}` | Sponsor link URL | "https://acme.com" |
| `{{sponsor_cta}}` | Sponsor CTA text | "Learn More" |
| `{{closing_text}}` | Closing message | "Thanks for reading!" |

## Example: Sending via Resend API

```javascript
const { Resend } = require('resend');
const resend = new Resend('your-api-key');

await resend.emails.send({
  from: 'VersionVault <newsletter@versionvault.dev>',
  to: 'user@example.com',
  subject: 'Product Updates - January 2025',
  template_id: 'your-template-id', // Get this from Resend dashboard
  template_data: {
    newsletter_title: 'Product Updates',
    newsletter_type: 'Monthly Newsletter',
    user_name: 'Andy',
    user_id: 'user_123',
    intro_text: 'Happy New Year! Here\'s what we shipped in January.',
    main_content: `
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 16px 0;">🚀 What's New</h2>
      <ul style="color: #a3a3a3; line-height: 1.8; margin: 0 0 24px 0;">
        <li>New feature: Bulk software tracking</li>
        <li>Improved: Faster version checks</li>
        <li>Fixed: Email notification timing</li>
      </ul>
    `,
    feature_highlight: true,
    feature_title: 'Bulk Import Now Available',
    feature_description: 'Import multiple software packages at once with our new CSV import feature.',
    feature_link: 'https://versionvault.dev/import',
    feature_cta_text: 'Try It Now',
    cta_button: true,
    cta_text: 'Read Full Changelog',
    cta_link: 'https://versionvault.dev/changelog',
    closing_text: 'Thanks for using VersionVault! We\'re excited to ship more features this year.'
  }
});
```

## Example: Manual Newsletter Content

### Product Update Newsletter

```javascript
{
  newsletter_title: 'January Product Updates',
  newsletter_type: 'Product Updates',
  user_name: 'there',
  intro_text: 'Happy New Year! We've been hard at work improving VersionVault. Here's what's new:',
  main_content: `
    <div style="margin-bottom: 24px;">
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">🚀 New Features</h2>
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #ffffff;">Bulk Software Import</p>
        <p style="margin: 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">Import multiple software packages at once using CSV files. Perfect for teams managing large software portfolios.</p>
      </div>
      <div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px;">
        <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 600; color: #ffffff;">Custom Notification Rules</p>
        <p style="margin: 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">Set up custom rules for when you want to be notified - major updates only, specific software, or everything.</p>
      </div>
    </div>
    <div style="margin-bottom: 24px;">
      <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">🛠️ Improvements</h2>
      <ul style="color: #a3a3a3; line-height: 1.8; margin: 0; padding-left: 20px;">
        <li>Version checker now runs 2x faster</li>
        <li>Improved mobile dashboard layout</li>
        <li>Better error messages for failed checks</li>
      </ul>
    </div>
  `,
  cta_button: true,
  cta_text: 'View Full Changelog',
  cta_link: 'https://versionvault.dev/changelog',
  closing_text: 'Have feedback? Reply to this email - we read every message!'
}
```

### Announcement Newsletter

```javascript
{
  newsletter_title: 'Important Service Update',
  newsletter_type: 'Announcement',
  user_name: 'there',
  intro_text: 'We wanted to let you know about some upcoming changes to VersionVault.',
  main_content: `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #ffffff; font-weight: 600;">Scheduled Maintenance</p>
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">
      We'll be performing scheduled maintenance on <strong style="color: #ffffff;">Saturday, January 15th from 2:00 AM - 4:00 AM EST</strong>.
      During this time, the dashboard may be unavailable.
    </p>
    <p style="margin: 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">
      Version checking and email notifications will continue to work normally. We'll send you an update when maintenance is complete.
    </p>
  `,
  notice_text: 'Your tracked software and notification settings will not be affected by this maintenance.',
  notice_title: 'No Action Required',
  closing_text: 'Questions? Email us at support@versionvault.dev'
}
```

### Tips & Tricks Newsletter

```javascript
{
  newsletter_title: 'VersionVault Tips & Tricks',
  newsletter_type: 'Tips & Best Practices',
  user_name: 'there',
  intro_text: 'Get more out of VersionVault with these power user tips:',
  main_content: `
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 8px 0;">💡 Tip #1: Use Tags to Organize Software</h3>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        Create custom tags like "Production", "Development", or "Critical" to quickly filter your tracked software.
      </p>
    </div>
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 8px 0;">💡 Tip #2: Set Different Frequencies per Software</h3>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        You can set different notification frequencies for each piece of software. Monitor critical apps daily and others weekly.
      </p>
    </div>
    <div style="margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 16px; margin: 0 0 8px 0;">💡 Tip #3: Share Your Dashboard</h3>
      <p style="margin: 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">
        Generate a public read-only link to share your software version dashboard with your team.
      </p>
    </div>
  `,
  cta_button: true,
  cta_text: 'Explore All Features',
  cta_link: 'https://versionvault.dev/features'
}
```

## HTML Styling Tips for `main_content`

The template uses inline CSS. Here are some helpful styles that match the VersionVault design:

```html
<!-- Card/Box -->
<div style="background-color: #171717; border: 1px solid #262626; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
  Content here
</div>

<!-- Heading -->
<h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">Heading</h2>

<!-- Paragraph -->
<p style="margin: 0 0 16px 0; font-size: 14px; color: #a3a3a3; line-height: 1.6;">Text</p>

<!-- Strong/Bold Text -->
<strong style="color: #ffffff;">Important text</strong>

<!-- Link -->
<a href="#" style="color: #3b82f6; text-decoration: underline;">Link text</a>

<!-- Bullet List -->
<ul style="color: #a3a3a3; line-height: 1.8; margin: 0; padding-left: 20px;">
  <li>Item 1</li>
  <li>Item 2</li>
</ul>

<!-- Code/Monospace Text -->
<code style="font-family: monospace; background-color: #171717; border: 1px solid #262626; padding: 2px 6px; border-radius: 4px; color: #ffffff;">code here</code>
```

## Color Palette

- **Background**: `#0a0a0a` (very dark)
- **Card Background**: `#171717` (dark gray)
- **Border**: `#262626` (medium gray)
- **Primary Text**: `#ffffff` (white)
- **Secondary Text**: `#a3a3a3` (light gray)
- **Muted Text**: `#525252` (medium gray)
- **Primary Blue**: `#2563eb` (CTA buttons)
- **Link Blue**: `#3b82f6`
- **Success Green**: `#22c55e`
- **Warning Orange**: `#f59e0b`
- **Error Red**: `#dc2626`
- **Purple (New)**: `#8b5cf6`

## Testing the Template

Before sending to your full list, always send a test email:

```javascript
await resend.emails.send({
  from: 'VersionVault <newsletter@versionvault.dev>',
  to: 'your-test-email@example.com',
  subject: 'TEST: Newsletter',
  template_id: 'your-template-id',
  template_data: { /* your variables */ }
});
```

## Need Help?

- Resend Documentation: https://resend.com/docs
- Resend Templates Guide: https://resend.com/docs/send-with-templates
- Template Variables: https://resend.com/docs/template-variables
