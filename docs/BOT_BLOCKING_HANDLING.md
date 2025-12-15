# Bot Blocking Handling - Comprehensive Guide

## Overview

This document explains how VersionVault handles bot blocking from various anti-scraping systems like Cloudflare, Akamai, DataDome, and PerimeterX.

## Problem Statement

Many software vendor websites use sophisticated bot detection systems that block automated access:

- **Cloudflare**: JavaScript challenges, browser verification
- **Akamai**: Bot detection, reference errors
- **DataDome**: CAPTCHA delivery, request fingerprinting
- **PerimeterX**: Behavioral analysis, CAPTCHA challenges
- **Rate Limiting**: 429 errors, IP throttling
- **HTTP2 Errors**: Protocol-level blocking

## Solution Architecture

### 1. Progressive Fallback Strategy

The system uses a multi-layered approach that progressively escalates through more sophisticated methods:

```
┌─────────────────────────────────────────────────────────────┐
│  Attempt 1: Static Fetch + Realistic Headers                │
│  - Fast, low cost                                            │
│  - Realistic User-Agent rotation                             │
│  - Full browser headers (Accept, Accept-Language, etc.)      │
└─────────────────────────────────────────────────────────────┘
                           ↓ (if blocked)
┌─────────────────────────────────────────────────────────────┐
│  Attempt 2: Retry with Different User-Agent + Delay          │
│  - Wait 2 seconds (exponential backoff)                      │
│  - Rotate to different browser User-Agent                    │
└─────────────────────────────────────────────────────────────┘
                           ↓ (if blocked)
┌─────────────────────────────────────────────────────────────┐
│  Attempt 3: Browserless (Headless Chrome) + Stealth          │
│  - Full JavaScript rendering                                 │
│  - Stealth mode enabled                                      │
│  - Wait 4 seconds before retry                               │
└─────────────────────────────────────────────────────────────┘
                           ↓ (if blocked)
┌─────────────────────────────────────────────────────────────┐
│  Attempt 4: Browserless Extended + Extra Wait                │
│  - Extended timeout (60s instead of 30s)                     │
│  - networkidle0 (wait for ALL network activity)              │
│  - Additional 5s wait for JS challenges                      │
│  - Wait 8 seconds before retry                               │
└─────────────────────────────────────────────────────────────┘
                           ↓ (if blocked)
┌─────────────────────────────────────────────────────────────┐
│  Fallback: Domain Extraction                                 │
│  - Extract manufacturer from domain name                     │
│  - Return partial data                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2. Bot Blocker Detection

The system can detect and identify specific bot blocking systems:

#### Cloudflare Detection
- **Indicators**: `cf-ray` header, "checking your browser", `cf-challenge`
- **Confidence**: 95%
- **Action**: Use Browserless with extended wait time

#### Akamai Detection
- **Indicators**: "Reference #XXX" format, "access denied", low content
- **Confidence**: 85%
- **Action**: More realistic headers + retry with delay

#### DataDome Detection
- **Indicators**: "datadome", "dd-request-id", "captcha-delivery"
- **Confidence**: 90%
- **Action**: Rotate User-Agent + realistic headers

#### PerimeterX Detection
- **Indicators**: "perimeterx", "px-captcha", `_px` cookies
- **Confidence**: 90%
- **Action**: Browserless with cookies and realistic behavior

#### Rate Limiting
- **Indicators**: HTTP 429 status
- **Confidence**: 100%
- **Action**: Exponential backoff (2s → 4s → 8s → 16s)

### 3. User-Agent Rotation

Instead of identifying as a bot, the system rotates through realistic browser User-Agents:

```typescript
const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...',

  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36...',

  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',

  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',

  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15...',

  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36... Edg/120.0.0.0',
]
```

### 4. Realistic Browser Headers

The system sends complete browser-like headers:

```typescript
{
  'User-Agent': '<rotated realistic UA>',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
}
```

### 5. Exponential Backoff

When retrying, the system uses exponential backoff to avoid rate limits:

- **Attempt 1**: Immediate
- **Attempt 2**: Wait 2 seconds
- **Attempt 3**: Wait 4 seconds
- **Attempt 4**: Wait 8 seconds
- **Max delay**: 16 seconds

## Usage

### Basic Usage

```typescript
import { fetchWithRetry } from './_shared/fetch-with-retry.ts'

// Simple fetch with automatic retry and fallback
const result = await fetchWithRetry('https://example.com', {
  browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
})

console.log(`Success: ${result.success}`)
console.log(`Method used: ${result.method}`)
console.log(`Attempts: ${result.attempts}`)
console.log(`Content: ${result.html.length} chars`)

if (result.blockerDetected) {
  console.log(`Blocker: ${result.blockerDetected.blockerType}`)
  console.log(`Confidence: ${result.blockerDetected.confidence}%`)
}
```

### Advanced Configuration

```typescript
const result = await fetchWithRetry('https://example.com', {
  browserlessApiKey: apiKey,
  startingMethod: 'browserless', // Skip static fetch
  retryConfig: {
    maxAttempts: 5,
    baseDelay: 3000, // 3 seconds base delay
    rotateUserAgent: true,
    escalateMethods: true,
  },
})
```

### Manual Bot Detection

```typescript
import { detectBotBlocker } from './_shared/bot-blocker-handler.ts'

const detection = detectBotBlocker(html, statusCode, headers, error)

if (detection.isBlocked) {
  console.log(`Blocked by: ${detection.blockerType}`)
  console.log(`Suggested action: ${detection.suggestedAction}`)
}
```

## Integration with Existing Code

### Before (Old Code)

```typescript
// Old code in extract-software-info/index.ts
async function fetchSimpleHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0)',
    },
  })
  return await response.text()
}
```

### After (New Code)

```typescript
import { fetchWithRetry } from './_shared/fetch-with-retry.ts'

// New code with retry and bot blocking handling
const result = await fetchWithRetry(url, {
  browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
})

if (!result.success) {
  console.error('Failed to fetch after all retries')
  if (result.blockerDetected) {
    console.error(`Blocked by: ${result.blockerDetected.blockerType}`)
  }
}

const html = result.html
```

## Best Practices

### 1. Start Conservative, Escalate When Needed

Don't jump straight to Browserless if static fetch works:

```typescript
// Let the system try static first
const result = await fetchWithRetry(url, {
  startingMethod: 'static', // Default
  browserlessApiKey: apiKey, // Only used if escalation needed
})
```

### 2. Respect Rate Limits

Always enable retry with backoff for rate-limited sites:

```typescript
const result = await fetchWithRetry(url, {
  retryConfig: {
    maxAttempts: 4,
    baseDelay: 2000,
  },
})
```

### 3. Monitor Blocker Types

Track which blockers you encounter to optimize strategy:

```typescript
if (result.blockerDetected) {
  // Log to analytics/monitoring
  analytics.track('bot_blocker_detected', {
    blocker: result.blockerDetected.blockerType,
    url: url,
    confidence: result.blockerDetected.confidence,
  })
}
```

### 4. Cache Successful Strategies

If a site consistently requires a specific method, cache it:

```typescript
// Check cache first
const cachedMethod = await getSuccessfulMethod(domain)

const result = await fetchWithRetry(url, {
  startingMethod: cachedMethod || 'static',
})

// Store successful method
if (result.success) {
  await cacheSuccessfulMethod(domain, result.method)
}
```

## Troubleshooting

### Issue: Still Getting Blocked by Cloudflare

**Solution**: Use extended Browserless with extra wait time:

```typescript
const result = await fetchWithRetry(url, {
  startingMethod: 'browserless-extended',
  browserlessApiKey: apiKey,
})
```

### Issue: 429 Rate Limit Errors

**Solution**: Increase base delay and max attempts:

```typescript
const result = await fetchWithRetry(url, {
  retryConfig: {
    maxAttempts: 5,
    baseDelay: 5000, // 5 second base delay
  },
})
```

### Issue: Adobe or Other Known Difficult Sites

**Solution**: Consider manual content input or official APIs:

```typescript
// Detect problematic domains early
const url = new URL(versionUrl)
if (url.hostname.includes('adobe.com')) {
  console.warn('Adobe domains may require manual content input')
  // Suggest to user to use manual input or API
}
```

## Performance Considerations

### Cost vs Success Rate

| Method | Cost (Browserless) | Success Rate | Use Case |
|--------|-------------------|--------------|----------|
| Static | Free | ~60% | Simple sites, APIs |
| Browserless | ~$0.002/request | ~85% | JavaScript sites |
| Extended | ~$0.005/request | ~95% | Cloudflare, tough blockers |
| Interactive | ~$0.01/request | ~98% | Complex UIs, modals |

### Optimization Tips

1. **Cache successful methods** per domain
2. **Skip static fetch** for known JavaScript-heavy sites
3. **Batch requests** to avoid rate limits
4. **Use webhooks** for async processing of difficult sites

## API Reference

### `fetchWithRetry(url, options)`

Fetches a URL with automatic retry and bot blocker handling.

**Parameters:**
- `url: string` - URL to fetch
- `options: FetchWithRetryOptions`
  - `browserlessApiKey?: string` - Browserless API key (required for escalation)
  - `startingMethod?: FetchMethod` - Starting method (`'static'` | `'browserless'` | `'browserless-extended'` | `'interactive'`)
  - `retryConfig?: Partial<RetryConfig>` - Retry configuration

**Returns:** `Promise<FetchResult>`
- `html: string` - Fetched HTML content
- `method: FetchMethod` - Method that succeeded
- `success: boolean` - Whether fetch was successful
- `attempts: number` - Number of attempts made
- `blockerDetected?: BlockerDetection` - Detected blocker info

### `detectBotBlocker(html, statusCode, headers, error)`

Detects bot blocking in response or error.

**Returns:** `BlockerDetection`
- `isBlocked: boolean` - Whether blocking was detected
- `blockerType: BlockerType` - Type of blocker detected
- `confidence: number` - Confidence level (0-100)
- `message: string` - Human-readable message
- `suggestedAction: string` - Suggested next action

### `getRandomUserAgent()`

Returns a random realistic User-Agent string.

### `getRealisticHeaders(userAgent?)`

Returns a full set of realistic browser headers.

## Future Enhancements

### Planned Features

1. **Proxy Support**: Rotate IPs for blocked sites
2. **CAPTCHA Solving**: Integration with 2Captcha or similar
3. **Pattern Learning**: ML-based detection of blocking patterns
4. **Browser Fingerprinting**: More sophisticated browser emulation
5. **Cookie Persistence**: Session handling for multi-page scraping

### Experimental Features

- **Residential Proxies**: For IP-level blocking
- **Browser Pool**: Reuse browser sessions
- **Smart Delay**: Randomized delays to mimic human behavior

## Conclusion

The bot blocking handler provides a robust, multi-layered approach to handling modern anti-scraping systems. By combining realistic headers, User-Agent rotation, exponential backoff, and progressive method escalation, it maximizes success rate while minimizing cost.

For most use cases, the default configuration will work well. For particularly difficult sites, consider using manual content input or official APIs when available.
