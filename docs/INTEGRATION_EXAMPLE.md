# Bot Blocking Handler - Integration Example

This document shows **exactly** how to integrate the new bot blocking handler into the existing `extract-software-info/index.ts` function.

## Quick Start

### Step 1: Import the New Functions

Add these imports at the top of `extract-software-info/index.ts`:

```typescript
import { fetchWithRetry, type FetchResult } from '../_shared/fetch-with-retry.ts'
import { detectBotBlocker, logBotBlocking } from '../_shared/bot-blocker-handler.ts'
```

### Step 2: Replace Existing Fetch Functions

#### Replace `fetchSimpleHTML()`

**Before:**
```typescript
async function fetchSimpleHTML(url: string): Promise<string> {
  console.log(`📄 Fetching simple HTML: ${url}`)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0; +https://versionvault.dev)',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    console.log(`✅ Fetched ${html.length} characters`)
    return html
  } catch (error) {
    console.error('❌ Simple HTML fetch failed:', error)
    return ''
  }
}
```

**After:**
```typescript
async function fetchSimpleHTML(url: string): Promise<string> {
  console.log(`📄 Fetching HTML with bot blocking protection: ${url}`)

  const result = await fetchWithRetry(url, {
    browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
    retryConfig: {
      maxAttempts: 3, // Try 3 times before escalating
      rotateUserAgent: true,
      escalateMethods: true,
    },
  })

  if (!result.success) {
    console.error('❌ Fetch failed after all retries')
    if (result.blockerDetected) {
      console.error(`Blocked by: ${result.blockerDetected.blockerType}`)
      console.error(`Suggestion: ${result.blockerDetected.suggestedAction}`)
    }
  } else {
    console.log(`✅ Successfully fetched using method: ${result.method}`)
  }

  return result.html
}
```

#### Replace `fetchWithBrowserless()`

**Before:**
```typescript
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set, skipping browser rendering')
    return ''
  }

  try {
    console.log(`🌐 Fetching with Browserless (headless Chrome): ${url}`)

    const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}&stealth=true`

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        setExtraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Browserless error: ${response.status} - ${error}`)
    }

    const html = await response.text()
    console.log(`✅ Browserless fetched ${html.length} characters`)
    return html

  } catch (error) {
    console.error(`❌ Browserless fetch failed for ${url}:`, error)

    const errorMsg = error?.message || String(error)
    if (errorMsg.includes('ERR_HTTP2_PROTOCOL_ERROR') || errorMsg.includes('ERR_CONNECTION')) {
      console.warn('⚠️ Site may be blocking automated browsers (HTTP2/connection errors)')
    }

    return ''
  }
}
```

**After:**
```typescript
async function fetchWithBrowserless(url: string): Promise<string> {
  const apiKey = Deno.env.get('BROWSERLESS_API_KEY')

  if (!apiKey) {
    console.warn('BROWSERLESS_API_KEY not set, skipping browser rendering')
    return ''
  }

  console.log(`🌐 Fetching with Browserless + bot blocking protection: ${url}`)

  // Use fetchWithRetry starting from browserless method
  const result = await fetchWithRetry(url, {
    browserlessApiKey: apiKey,
    startingMethod: 'browserless', // Skip static fetch, go straight to browserless
    retryConfig: {
      maxAttempts: 3,
      rotateUserAgent: false, // Browserless handles UA
      escalateMethods: true, // Can escalate to extended if needed
    },
  })

  if (!result.success && result.blockerDetected) {
    // Specific error handling based on blocker type
    if (result.blockerDetected.blockerType === 'cloudflare') {
      console.warn('⚠️ Cloudflare detected - may need extended wait time')
    } else if (result.blockerDetected.blockerType === 'http2-error') {
      console.warn('⚠️ HTTP/2 protocol error - site blocking automated browsers')
    }
  }

  return result.html
}
```

### Step 3: Enhance Content Fetch Logic

Update the main content fetching logic to track blocker types:

**Before:**
```typescript
// Fetch version content
let versionContent = ''
if (providedVersionContent) {
  versionContent = providedVersionContent
  console.log(`Using provided version content: ${versionContent.length} characters`)
} else if (versionUrl) {
  if (versionUrl.endsWith('.pdf')) {
    versionContent = await fetchPDFContent(versionUrl)
  } else {
    // Try interactive scraping first if we have a strategy
    if (scrapingStrategy) {
      versionContent = await fetchWithInteraction(versionUrl, scrapingStrategy)
    }

    // If interactive didn't work or wasn't attempted, try Browserless
    if (!versionContent) {
      versionContent = await fetchWithBrowserless(versionUrl)
    }

    // If Browserless didn't work, fall back to simple fetch
    if (!versionContent) {
      versionContent = await fetchSimpleHTML(versionUrl)
    }
  }
}
```

**After:**
```typescript
// Fetch version content with enhanced bot blocking protection
let versionContent = ''
let extractionMethod = 'none'
let blockerDetected: any = null

if (providedVersionContent) {
  versionContent = providedVersionContent
  extractionMethod = 'provided'
  console.log(`Using provided version content: ${versionContent.length} characters`)
} else if (versionUrl) {
  if (versionUrl.endsWith('.pdf')) {
    versionContent = await fetchPDFContent(versionUrl)
    extractionMethod = 'pdf'
  } else {
    // Use fetchWithRetry which handles the progressive fallback automatically
    const result = await fetchWithRetry(versionUrl, {
      browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
      startingMethod: scrapingStrategy ? 'interactive' : 'static',
      retryConfig: {
        maxAttempts: 4,
        rotateUserAgent: true,
        escalateMethods: true,
      },
    })

    versionContent = result.html
    extractionMethod = result.method
    blockerDetected = result.blockerDetected

    if (blockerDetected?.isBlocked) {
      console.warn(`⚠️ Bot blocker detected: ${blockerDetected.blockerType}`)
      console.warn(`Confidence: ${blockerDetected.confidence}%`)
      console.warn(`Suggestion: ${blockerDetected.suggestedAction}`)
    }
  }
}

// Add blocker info to the response later
if (blockerDetected?.isBlocked) {
  extracted.blockerDetected = {
    type: blockerDetected.blockerType,
    confidence: blockerDetected.confidence,
    message: blockerDetected.message,
  }
}
```

### Step 4: Update Domain-Specific Handling

For known problematic domains (like Adobe), add early detection:

**Before:**
```typescript
// Check if it's a known problematic domain
const url = new URL(versionUrl)
if (url.hostname.includes('adobe.com') || url.hostname.includes('helpx.adobe')) {
  console.error('⚠️ Adobe domains are known to block automated browsers')
  console.error('Recommendation: Use manual content input or Adobe\'s official API')
}
```

**After:**
```typescript
// Check if it's a known problematic domain and adjust strategy
const url = new URL(versionUrl)
const isKnownDifficult = url.hostname.includes('adobe.com') ||
                        url.hostname.includes('helpx.adobe') ||
                        url.hostname.includes('autodesk.com')

if (isKnownDifficult) {
  console.warn('⚠️ Known difficult domain - may require extended fetch strategy')
}

// Use appropriate starting method
const startingMethod = isKnownDifficult ? 'browserless-extended' : 'static'

const result = await fetchWithRetry(versionUrl, {
  browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
  startingMethod,
  retryConfig: {
    maxAttempts: isKnownDifficult ? 5 : 4,
    baseDelay: isKnownDifficult ? 3000 : 2000,
  },
})
```

## Complete Example Function

Here's a complete example of a simplified fetch function with full bot blocking protection:

```typescript
async function fetchContentWithProtection(
  url: string,
  isKnownDifficult: boolean = false
): Promise<{ content: string; method: string; blocker?: any }> {

  const result = await fetchWithRetry(url, {
    browserlessApiKey: Deno.env.get('BROWSERLESS_API_KEY'),
    startingMethod: isKnownDifficult ? 'browserless-extended' : 'static',
    retryConfig: {
      maxAttempts: isKnownDifficult ? 5 : 4,
      baseDelay: isKnownDifficult ? 3000 : 2000,
      rotateUserAgent: true,
      escalateMethods: true,
    },
  })

  // Log results
  if (result.success) {
    console.log(`✅ Successfully fetched using ${result.method} after ${result.attempts} attempt(s)`)
  } else {
    console.error(`❌ Failed to fetch after ${result.attempts} attempts`)

    if (result.blockerDetected) {
      console.error(`Blocker: ${result.blockerDetected.blockerType}`)
      console.error(`Message: ${result.blockerDetected.message}`)
      console.error(`Suggestion: ${result.blockerDetected.suggestedAction}`)
    }
  }

  return {
    content: result.html,
    method: result.method,
    blocker: result.blockerDetected?.isBlocked ? result.blockerDetected : undefined,
  }
}
```

## Testing the Integration

### Test 1: Simple Site (No Blocking)

```typescript
const result = await fetchContentWithProtection('https://nodejs.org/en/download')
// Expected: Success with 'static' method on first attempt
```

### Test 2: Cloudflare-Protected Site

```typescript
const result = await fetchContentWithProtection('https://example-with-cloudflare.com')
// Expected: Escalation to 'browserless-extended', blocker type: 'cloudflare'
```

### Test 3: Known Difficult Domain

```typescript
const result = await fetchContentWithProtection('https://helpx.adobe.com/...', true)
// Expected: Start with 'browserless-extended', multiple retries
```

## Monitoring and Analytics

Track bot blocking incidents for optimization:

```typescript
// After fetch
if (result.blockerDetected?.isBlocked) {
  // Log to your analytics system
  await logAnalytics({
    event: 'bot_blocker_detected',
    properties: {
      url: versionUrl,
      blocker_type: result.blockerDetected.blockerType,
      confidence: result.blockerDetected.confidence,
      final_method: result.method,
      attempts: result.attempts,
      success: result.success,
    },
  })
}
```

## Summary

The integration is straightforward:

1. **Import** the new functions
2. **Replace** existing fetch functions with `fetchWithRetry`
3. **Configure** retry options based on site difficulty
4. **Handle** blocker detection results
5. **Monitor** blocking incidents for optimization

The new system will automatically:
- ✅ Rotate User-Agents
- ✅ Use realistic browser headers
- ✅ Retry with exponential backoff
- ✅ Escalate to more sophisticated methods
- ✅ Detect and identify specific blockers
- ✅ Provide actionable suggestions

All while maintaining backward compatibility with the existing code structure.
