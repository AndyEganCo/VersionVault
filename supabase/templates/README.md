# Supabase Email Templates

This directory contains custom email templates for Supabase authentication flows.

## Templates Included

All templates are configured in `supabase/config.toml` and include:

1. **confirm-signup.html** - Sent when users sign up to verify their email address
2. **invite.html** - Sent when inviting users who don't have an account yet
3. **magic-link.html** - Sent for passwordless authentication (magic link login)
4. **change-email.html** - Sent when users request to change their email address
5. **reset-password.html** - Sent when users request a password reset
6. **reauthentication.html** - Sent when users need to confirm their identity for sensitive actions

## Template Variables

Each template uses Supabase's built-in template variables:

- `{{ .ConfirmationURL }}` - The confirmation/action URL
- `{{ .Token }}` - One-time code (6 digits)
- `{{ .TokenHash }}` - Hashed token for custom URLs

## For Local Development

The templates are automatically used when running Supabase locally via the `config.toml` configuration.

To test locally:
```bash
# Start Supabase (if CLI is installed)
supabase start

# The templates will be used for all authentication emails
```

## For Production

To use these templates in your hosted Supabase project:

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. For each template type (Confirm signup, Invite user, Magic Link, etc.):
   - Click on the template
   - Copy the HTML content from the corresponding file in this directory
   - Paste it into the template editor
   - Update the subject line to match the one in `config.toml`
   - Click **Save**

### Option 2: Via Supabase CLI
```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# The templates should sync when you deploy
```

## Customization

To customize the templates:

1. Edit the HTML files in this directory
2. The templates use inline CSS for maximum email client compatibility
3. Keep the template variables (`{{ .ConfirmationURL }}`, `{{ .Token }}`) intact
4. Update the branding, colors, and messaging as needed
5. Test the templates locally before deploying to production

## Design Features

- **Responsive Design**: Templates work on mobile and desktop email clients
- **Inline CSS**: Maximum compatibility with email clients
- **Brand Consistency**: Purple gradient matching VersionVault branding
- **Security Notices**: Clear warnings for suspicious activity
- **Accessible**: High contrast and clear messaging

## Testing

To test templates locally:
1. Start your local Supabase instance
2. Trigger the authentication flow (signup, password reset, etc.)
3. Check Inbucket at `http://localhost:54324` to view sent emails
4. Verify the template renders correctly

## Support

For more information on Supabase email templates, see:
- [Customizing Email Templates](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Auth Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
