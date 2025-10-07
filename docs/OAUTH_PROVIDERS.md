# OAuth Providers Configuration

This document describes how to configure OAuth authentication providers for the application.

## Overview

The application uses NextAuth.js with OAuth providers for authentication. Users can sign in using:
- Google
- GitHub
- Yandex
- Mail.ru

**Note:** User accounts are created automatically on first sign-in. No traditional email/password registration is required.

## Provider Configuration

OAuth providers are configured in `auth.config.ts` with runtime validation. The configuration:

1. **Validates environment variables** at startup
2. **Enables only providers** with both `clientId` and `clientSecret` configured
3. **Logs warnings** in development for missing providers
4. **Throws an error** if no providers are configured

### Required Environment Variables

At least one OAuth provider must be fully configured. For each provider you want to enable, add both credentials:

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Yandex OAuth
YANDEX_CLIENT_ID=your_yandex_client_id
YANDEX_CLIENT_SECRET=your_yandex_client_secret

# Mail.ru OAuth
MAILRU_CLIENT_ID=your_mailru_client_id
MAILRU_CLIENT_SECRET=your_mailru_client_secret
```

## Behavior

### Development Mode
- Logs enabled providers: `[auth.config] Enabled OAuth providers: Google, GitHub, Yandex, Mail.ru`
- Warns about disabled providers with missing credentials
- Example: `[auth.config] GitHub provider disabled. Missing: GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET`

### Production Mode
- Silently enables providers with valid credentials
- No warning logs for missing providers (to avoid log spam)
- Throws clear error if NO providers are configured

### Error Example

If no providers are configured, you'll see:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NextAuth Configuration Error: No OAuth providers configured!

At least one OAuth provider must be configured with valid credentials.

Missing providers: Google, GitHub, Yandex, Mail.ru

Required environment variables (at least one pair):
  • GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
  • GITHUB_CLIENT_ID + GITHUB_CLIENT_SECRET
  • YANDEX_CLIENT_ID + YANDEX_CLIENT_SECRET
  • MAILRU_CLIENT_ID + MAILRU_CLIENT_SECRET

Please add the required environment variables to your .env file.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Getting OAuth Credentials

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Set authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
6. Copy Client ID and Client Secret

### GitHub OAuth
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Set Authorization callback URL: `https://yourdomain.com/api/auth/callback/github`
4. Copy Client ID and generate Client Secret

### Yandex OAuth
1. Go to [Yandex OAuth](https://oauth.yandex.ru/)
2. Create new application
3. Set Callback URI: `https://yourdomain.com/api/auth/callback/yandex`
4. Copy Client ID and Client Secret

### Mail.ru OAuth
1. Go to [Mail.ru OAuth](https://oauth.mail.ru/app/)
2. Create new application
3. Set Redirect URI: `https://yourdomain.com/api/auth/callback/mailru`
4. Copy Client ID and Client Secret

## Local Development

For local development, use `http://localhost:3000` instead of your production domain:

```
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/github
http://localhost:3000/api/auth/callback/yandex
http://localhost:3000/api/auth/callback/mailru
```

## Adding New Providers

To add a new OAuth provider:

1. Install the provider package (if not built-in to NextAuth)
2. Import the provider in `auth.config.ts`
3. Add configuration to `providerConfigs` array:

```typescript
{
  name: "NewProvider",
  clientId: process.env.NEWPROVIDER_CLIENT_ID,
  clientSecret: process.env.NEWPROVIDER_CLIENT_SECRET,
  factory: (clientId: string, clientSecret: string) =>
    NewProvider({ clientId, clientSecret }),
}
```

4. Add environment variables to `.env`
5. Update UI in `app/(auth)/sign-in/page.tsx` and `app/(auth)/sign-up/page.tsx`

## Troubleshooting

### Provider not showing up
- Check that both `CLIENT_ID` and `CLIENT_SECRET` are set in `.env`
- Restart the dev server after adding env vars
- Check dev console for warning messages

### "No OAuth providers configured" error
- At least one provider must be fully configured
- Verify `.env` file exists and has correct variable names
- Check for typos in environment variable names

### OAuth redirect errors
- Verify callback URLs match exactly in OAuth provider settings
- Include protocol (http:// or https://)
- Check for trailing slashes

## Security Notes

- Never commit `.env` files to version control
- Use different OAuth apps for development and production
- Rotate secrets regularly
- Use environment-specific callback URLs
- Enable HTTPS in production
