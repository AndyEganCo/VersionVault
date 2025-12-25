/**
 * Enhanced Bot Blocking Detection and Fallback Handler
 *
 * Provides sophisticated bot blocker detection, User-Agent rotation,
 * retry logic with exponential backoff, and progressive fallback strategies.
 */

/**
 * Realistic User-Agent strings that mimic real browsers
 * Rotates between different browsers and platforms
 */
export const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
]

/**
 * Get a random realistic User-Agent
 */
export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Get realistic browser headers to evade bot detection
 */
export function getRealisticHeaders(userAgent?: string): Record<string, string> {
  return {
    'User-Agent': userAgent || getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
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
}

/**
 * Types of bot blockers detected
 */
export type BlockerType =
  | 'cloudflare'
  | 'akamai'
  | 'datadome'
  | 'perimeterx'
  | 'rate-limit'
  | 'http2-error'
  | 'connection-error'
  | 'unknown'
  | null

/**
 * Detection result
 */
export interface BlockerDetection {
  isBlocked: boolean
  blockerType: BlockerType
  confidence: number // 0-100
  message: string
  suggestedAction: string
}

/**
 * Detect specific bot blocker from response or error
 */
export function detectBotBlocker(
  html: string,
  statusCode?: number,
  headers?: Headers,
  error?: Error
): BlockerDetection {

  // Check for error-based blocking
  if (error) {
    const errorMsg = error.message || String(error)

    // HTTP2 protocol errors
    if (errorMsg.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
      return {
        isBlocked: true,
        blockerType: 'http2-error',
        confidence: 90,
        message: 'HTTP/2 protocol error detected - site may be blocking automated browsers',
        suggestedAction: 'Retry with different User-Agent or use proxy'
      }
    }

    // Connection errors
    if (errorMsg.includes('ERR_CONNECTION') || errorMsg.includes('ECONNREFUSED')) {
      return {
        isBlocked: true,
        blockerType: 'connection-error',
        confidence: 80,
        message: 'Connection refused - possible IP blocking or network issue',
        suggestedAction: 'Retry with delay or use proxy'
      }
    }
  }

  // Check for rate limiting
  if (statusCode === 429) {
    return {
      isBlocked: true,
      blockerType: 'rate-limit',
      confidence: 100,
      message: 'Rate limit exceeded (HTTP 429)',
      suggestedAction: 'Retry with exponential backoff'
    }
  }

  // Check for Cloudflare
  const hasCloudflareHeader = headers?.get('cf-ray') || headers?.get('CF-RAY')
  const cloudflarePatterns = [
    /checking your browser/i,
    /cloudflare/i,
    /cf-browser-verification/i,
    /cf_clearance/i,
    /cf-challenge/i,
    /__cf_bm/i,
  ]

  if (hasCloudflareHeader || cloudflarePatterns.some(pattern => pattern.test(html))) {
    // Check if it's actually blocking or just present
    const isChallenge = /checking your browser|cf-challenge|cf-browser-verification/i.test(html)
    if (isChallenge || html.length < 2000) {
      return {
        isBlocked: true,
        blockerType: 'cloudflare',
        confidence: 95,
        message: 'Cloudflare challenge detected',
        suggestedAction: 'Use Browserless with extended wait time for JavaScript challenge'
      }
    }
  }

  // Check for Akamai
  const akamaiPatterns = [
    /akamai/i,
    /reference #\d+\.\w+/i, // Akamai error reference format
    /access denied/i,
  ]

  if (akamaiPatterns.some(pattern => pattern.test(html)) && html.length < 2000) {
    return {
      isBlocked: true,
      blockerType: 'akamai',
      confidence: 85,
      message: 'Akamai bot detection detected',
      suggestedAction: 'Use more realistic headers and retry with delay'
    }
  }

  // Check for DataDome
  const datadomePatterns = [
    /datadome/i,
    /dd-request-id/i,
    /captcha-delivery/i,
  ]

  if (datadomePatterns.some(pattern => pattern.test(html)) && html.length < 3000) {
    return {
      isBlocked: true,
      blockerType: 'datadome',
      confidence: 90,
      message: 'DataDome bot detection detected',
      suggestedAction: 'Retry with different User-Agent and realistic headers'
    }
  }

  // Check for PerimeterX
  const perimeterxPatterns = [
    /perimeterx/i,
    /px-captcha/i,
    /_px\d+/i,
  ]

  if (perimeterxPatterns.some(pattern => pattern.test(html)) && html.length < 3000) {
    return {
      isBlocked: true,
      blockerType: 'perimeterx',
      confidence: 90,
      message: 'PerimeterX bot detection detected',
      suggestedAction: 'Use Browserless with cookies and realistic behavior'
    }
  }

  // Check for generic blocking indicators
  const blockingIndicators = [
    /access denied/i,
    /forbidden/i,
    /blocked/i,
    /security check/i,
    /unusual traffic/i,
    /automated access/i,
  ]

  if (blockingIndicators.some(pattern => pattern.test(html)) && html.length < 2000) {
    return {
      isBlocked: true,
      blockerType: 'unknown',
      confidence: 70,
      message: 'Generic bot blocking detected',
      suggestedAction: 'Try different extraction method or headers'
    }
  }

  // No blocking detected
  return {
    isBlocked: false,
    blockerType: null,
    confidence: 0,
    message: 'No bot blocking detected',
    suggestedAction: ''
  }
}

/**
 * Calculate delay for exponential backoff
 */
export function getBackoffDelay(attempt: number, baseDelay: number = 2000): number {
  // Exponential backoff: 2s, 4s, 8s, 16s
  return Math.min(baseDelay * Math.pow(2, attempt), 16000)
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number
  baseDelay: number // milliseconds
  rotateUserAgent: boolean
  escalateMethods: boolean // Escalate from static → browserless → interactive
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 4,
  baseDelay: 2000,
  rotateUserAgent: true,
  escalateMethods: true,
}

/**
 * Fetch method types
 */
export type FetchMethod = 'static' | 'browserless' | 'browserless-extended' | 'interactive'

/**
 * Get next fetch method in escalation chain
 */
export function getNextFetchMethod(current: FetchMethod): FetchMethod | null {
  const escalationChain: FetchMethod[] = [
    'static',
    'browserless',
    'browserless-extended',
    'interactive',
  ]

  const currentIndex = escalationChain.indexOf(current)
  if (currentIndex === -1 || currentIndex === escalationChain.length - 1) {
    return null // No next method
  }

  return escalationChain[currentIndex + 1]
}

/**
 * Logs bot blocking detection in a structured way
 */
export function logBotBlocking(
  url: string,
  detection: BlockerDetection,
  attempt: number,
  maxAttempts: number
): void {
  if (!detection.isBlocked) return

  console.error('🚫 BOT BLOCKING DETECTED')
  console.error(`URL: ${url}`)
  console.error(`Blocker Type: ${detection.blockerType || 'unknown'}`)
  console.error(`Confidence: ${detection.confidence}%`)
  console.error(`Message: ${detection.message}`)
  console.error(`Suggested Action: ${detection.suggestedAction}`)
  console.error(`Attempt: ${attempt}/${maxAttempts}`)

  if (attempt < maxAttempts) {
    const nextDelay = getBackoffDelay(attempt)
    console.log(`⏳ Retrying in ${nextDelay}ms...`)
  } else {
    console.error('❌ Max retry attempts reached')
  }
}

/**
 * Get recommended Browserless options based on blocker type
 * Accepts optional URL to apply site-specific optimizations
 */
export function getBrowserlessOptions(blockerType: BlockerType, extended: boolean = false, url?: string) {
  const baseOptions = {
    gotoOptions: {
      waitUntil: 'networkidle2' as const,
      timeout: extended ? 60000 : 30000,
    },
    setExtraHTTPHeaders: getRealisticHeaders(),
  }

  // ServiceNow portals need special handling (Angular lazy loading)
  const isServiceNow = url && url.includes('support.zoom.com')
  if (isServiceNow) {
    console.log('🔧 Applying ServiceNow-specific Browserless configuration')
    return {
      ...baseOptions,
      gotoOptions: {
        waitUntil: 'networkidle2' as const, // Less strict than networkidle0
        timeout: 60000,
      },
      // Wait for content to appear (ServiceNow Angular rendering)
      waitForSelector: {
        selector: '.kb-article-content, .kb_article, article, [data-component="article"]',
        timeout: 10000 // Wait up to 10s for content to appear
      },
      // Additional delay after page load to ensure Angular finishes rendering
      addScriptTag: [{
        content: 'new Promise(r => setTimeout(r, 3000))' // 3 second delay
      }]
    }
  }

  // Extended options for tougher blockers
  if (extended || blockerType === 'cloudflare') {
    return {
      ...baseOptions,
      gotoOptions: {
        ...baseOptions.gotoOptions,
        waitUntil: 'networkidle0' as const, // Wait for all network activity to stop
        timeout: 60000, // Increased timeout for JavaScript challenges
      },
    }
  }

  return baseOptions
}
