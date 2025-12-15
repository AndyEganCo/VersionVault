/**
 * Fetch Wrapper with Retry Logic and Bot Blocker Handling
 *
 * Implements progressive fallback strategy:
 * 1. Static fetch with realistic headers
 * 2. Retry with different User-Agent + exponential backoff
 * 3. Browserless with stealth
 * 4. Browserless with extended wait (for Cloudflare)
 * 5. Interactive scraping (if strategy provided)
 */

import {
  getRandomUserAgent,
  getRealisticHeaders,
  detectBotBlocker,
  getBackoffDelay,
  sleep,
  logBotBlocking,
  getNextFetchMethod,
  getBrowserlessOptions,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type FetchMethod,
  type BlockerDetection,
} from './bot-blocker-handler.ts'

export interface FetchResult {
  html: string
  method: FetchMethod
  success: boolean
  attempts: number
  blockerDetected?: BlockerDetection
}

export interface FetchWithRetryOptions {
  retryConfig?: Partial<RetryConfig>
  startingMethod?: FetchMethod
  browserlessApiKey?: string
}

/**
 * Fetch with static HTTP request and realistic headers
 */
async function fetchStatic(url: string, userAgent?: string): Promise<string> {
  console.log(`📄 Fetching (static) with realistic headers: ${url}`)

  const response = await fetch(url, {
    headers: getRealisticHeaders(userAgent),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  console.log(`✅ Static fetch: ${html.length} characters`)

  return html
}

/**
 * Fetch with Browserless (headless Chrome) - Basic rendering
 */
async function fetchBrowserless(
  url: string,
  apiKey: string,
  extended: boolean = false,
  blockerType: any = null
): Promise<string> {
  console.log(`🌐 Fetching with Browserless${extended ? ' (extended)' : ''}: ${url}`)

  const browserlessUrl = `https://chrome.browserless.io/content?token=${apiKey}&stealth=true&bestAttempt=true`

  const options = getBrowserlessOptions(blockerType, extended)

  const response = await fetch(browserlessUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: url,
      ...options,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Browserless error: ${response.status} - ${error}`)
  }

  const html = await response.text()
  console.log(`✅ Browserless${extended ? ' (extended)' : ''}: ${html.length} characters`)

  return html
}

/**
 * Main fetch function with retry logic and progressive fallback
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<FetchResult> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options.retryConfig,
  }

  let currentMethod: FetchMethod = options.startingMethod || 'static'
  let lastError: Error | null = null
  let lastHtml = ''
  let lastBlockerDetection: BlockerDetection | undefined

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      console.log(`\n🔄 Attempt ${attempt + 1}/${config.maxAttempts} using method: ${currentMethod}`)

      // Get User-Agent (rotate on retry if enabled)
      const userAgent = config.rotateUserAgent && attempt > 0
        ? getRandomUserAgent()
        : undefined

      if (userAgent && attempt > 0) {
        console.log(`🔀 Rotating User-Agent: ${userAgent.substring(0, 50)}...`)
      }

      // Execute fetch based on current method
      let html: string

      switch (currentMethod) {
        case 'static':
          html = await fetchStatic(url, userAgent)
          break

        case 'browserless':
          if (!options.browserlessApiKey) {
            throw new Error('Browserless API key required for this method')
          }
          html = await fetchBrowserless(url, options.browserlessApiKey, false)
          break

        case 'browserless-extended':
          if (!options.browserlessApiKey) {
            throw new Error('Browserless API key required for this method')
          }
          html = await fetchBrowserless(
            url,
            options.browserlessApiKey,
            true,
            lastBlockerDetection?.blockerType
          )
          break

        case 'interactive':
          // For interactive, we would need the strategy object
          // For now, fall back to extended browserless
          if (!options.browserlessApiKey) {
            throw new Error('Browserless API key required for this method')
          }
          html = await fetchBrowserless(url, options.browserlessApiKey, true)
          break

        default:
          throw new Error(`Unknown fetch method: ${currentMethod}`)
      }

      // Check for bot blocking in the response
      const detection = detectBotBlocker(html)

      if (detection.isBlocked) {
        lastBlockerDetection = detection
        logBotBlocking(url, detection, attempt + 1, config.maxAttempts)

        // If we're blocked and can escalate, do so
        if (config.escalateMethods) {
          const nextMethod = getNextFetchMethod(currentMethod)
          if (nextMethod) {
            console.log(`⬆️ Escalating from ${currentMethod} to ${nextMethod}`)
            currentMethod = nextMethod

            // If we still have attempts left, retry with delay
            if (attempt + 1 < config.maxAttempts) {
              const delay = getBackoffDelay(attempt, config.baseDelay)
              await sleep(delay)
              continue
            }
          }
        }

        // Store the HTML even if blocked (might have some content)
        lastHtml = html
        lastError = new Error(detection.message)

        // If this is the last attempt, return what we have
        if (attempt + 1 >= config.maxAttempts) {
          console.error('❌ All retry attempts exhausted')
          return {
            html: lastHtml,
            method: currentMethod,
            success: false,
            attempts: attempt + 1,
            blockerDetected: detection,
          }
        }

        // Wait before retrying
        const delay = getBackoffDelay(attempt, config.baseDelay)
        await sleep(delay)
        continue
      }

      // Success! Check if content is substantial
      if (html.length < 1000) {
        console.warn(`⚠️ Low content (${html.length} chars) - possible blocking`)

        // Escalate method if possible
        if (config.escalateMethods && attempt + 1 < config.maxAttempts) {
          const nextMethod = getNextFetchMethod(currentMethod)
          if (nextMethod) {
            console.log(`⬆️ Low content detected, escalating to ${nextMethod}`)
            currentMethod = nextMethod
            const delay = getBackoffDelay(attempt, config.baseDelay)
            await sleep(delay)
            continue
          }
        }
      }

      // Return successful result
      console.log(`✅ Successfully fetched content using ${currentMethod}`)
      return {
        html,
        method: currentMethod,
        success: true,
        attempts: attempt + 1,
        blockerDetected: detection.isBlocked ? detection : undefined,
      }

    } catch (error) {
      lastError = error as Error
      console.error(`❌ Attempt ${attempt + 1} failed:`, error)

      // Detect bot blocking from error
      const detection = detectBotBlocker('', undefined, undefined, error as Error)

      if (detection.isBlocked) {
        lastBlockerDetection = detection
        logBotBlocking(url, detection, attempt + 1, config.maxAttempts)
      }

      // Escalate method if enabled and possible
      if (config.escalateMethods && attempt + 1 < config.maxAttempts) {
        const nextMethod = getNextFetchMethod(currentMethod)
        if (nextMethod) {
          console.log(`⬆️ Error detected, escalating from ${currentMethod} to ${nextMethod}`)
          currentMethod = nextMethod
        }
      }

      // If not the last attempt, wait and retry
      if (attempt + 1 < config.maxAttempts) {
        const delay = getBackoffDelay(attempt, config.baseDelay)
        await sleep(delay)
        continue
      }
    }
  }

  // All attempts failed
  console.error('❌ All fetch attempts failed')
  return {
    html: lastHtml,
    method: currentMethod,
    success: false,
    attempts: config.maxAttempts,
    blockerDetected: lastBlockerDetection,
  }
}

/**
 * Simple wrapper for backward compatibility
 * Returns empty string on failure instead of throwing
 */
export async function fetchWebpage(
  url: string,
  browserlessApiKey?: string
): Promise<string> {
  const result = await fetchWithRetry(url, {
    browserlessApiKey,
    retryConfig: {
      maxAttempts: 4,
      rotateUserAgent: true,
      escalateMethods: true,
    },
  })

  return result.html
}
