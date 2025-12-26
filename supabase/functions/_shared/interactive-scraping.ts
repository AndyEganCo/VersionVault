/**
 * Interactive Scraping Module
 *
 * Handles complex dynamic content that requires:
 * - Clicking "Read More" buttons
 * - Expanding accordions
 * - Waiting for JavaScript content to load
 * - Custom Puppeteer scripts
 *
 * Uses Browserless /function API for Puppeteer execution
 */

/**
 * Scraping strategy for interactive content extraction
 */
export interface ScrapingStrategy {
  releaseNotesSelectors?: string[]  // Buttons/links to click
  expandSelectors?: string[]        // Accordions to expand
  waitForSelector?: string          // Wait for element to appear
  waitTime?: number                 // Time to wait in ms (default 2000)
  customScript?: string             // Custom JavaScript to execute
}

/**
 * Generates Puppeteer script for interactive scraping
 * Converts ScrapingStrategy into executable browser code
 */
export function generatePuppeteerScript(url: string, strategy: ScrapingStrategy): string {
  const waitTime = strategy.waitTime || 2000

  // Build the script as an async function
  let script = `
export default async function scrape({ page, context }) {
  console.log('🎭 Starting interactive scraping for: ${url}');

  try {
    // Navigate to the page
    await page.goto('${url}', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    console.log('✅ Page loaded, starting interactions...');
`

  // Wait for initial selector if specified
  if (strategy.waitForSelector) {
    script += `
    // Wait for content to appear
    console.log('⏳ Waiting for selector: ${strategy.waitForSelector}');
    try {
      await page.waitForSelector('${strategy.waitForSelector}', {
        timeout: 40000,
        visible: true
      });
      console.log('✅ Content loaded');
    } catch (e) {
      console.warn('⚠️ Selector not found, continuing anyway:', e.message);
    }
`
  }

  // Click all release notes buttons/links
  if (strategy.releaseNotesSelectors && strategy.releaseNotesSelectors.length > 0) {
    script += `
    // Click all "Read More" / expandable buttons
    const selectors = ${JSON.stringify(strategy.releaseNotesSelectors)};

    for (const selector of selectors) {
      try {
        console.log('🔍 Looking for elements matching:', selector);
        const elements = await page.$$(selector);
        console.log(\`Found \${elements.length} elements for selector: \${selector}\`);

        for (let i = 0; i < elements.length; i++) {
          try {
            console.log(\`Clicking element \${i + 1}/\${elements.length}\`);
            await elements[i].click();
            await page.waitForTimeout(500); // Brief pause between clicks
          } catch (e) {
            console.warn(\`Failed to click element \${i + 1}:\`, e.message);
          }
        }
      } catch (e) {
        console.warn('No elements found for selector:', selector, e.message);
      }
    }
`
  }

  // Expand accordion elements
  if (strategy.expandSelectors && strategy.expandSelectors.length > 0) {
    script += `
    // Expand accordion/collapse elements
    const expandSelectors = ${JSON.stringify(strategy.expandSelectors)};

    for (const selector of expandSelectors) {
      try {
        const elements = await page.$$(selector);
        console.log(\`Found \${elements.length} elements to expand for: \${selector}\`);

        for (const element of elements) {
          try {
            const isVisible = await element.isIntersectingViewport();
            if (!isVisible) {
              await element.scrollIntoView();
              await page.waitForTimeout(200);
            }
          } catch (e) {
            // Scroll failed, continue anyway
          }
        }
      } catch (e) {
        console.warn('Failed to expand elements:', selector, e.message);
      }
    }
`
  }

  // Execute custom script if provided
  if (strategy.customScript) {
    script += `
    // Execute custom script
    console.log('🔧 Executing custom script...');
    try {
      ${strategy.customScript}
    } catch (e) {
      console.error('❌ Custom script failed:', e.message);
    }
`
  }

  // Final wait for content to settle
  script += `
    // Wait for content to settle
    console.log('⏳ Waiting ${waitTime}ms for content to fully load...');
    await page.waitForTimeout(${waitTime});

    // Get final HTML
    const html = await page.content();
    console.log(\`✅ Scraping complete: \${html.length} characters\`);

    return html;

  } catch (error) {
    console.error('❌ Interactive scraping error:', error);
    // Return whatever content we have
    const html = await page.content();
    return html;
  }
}
`

  return script
}

/**
 * Fetches webpage with INTERACTIVE scraping
 * Uses Browserless /function API to execute Puppeteer scripts for:
 * - Clicking "Read More" buttons
 * - Expanding accordions
 * - Waiting for dynamic content
 * - Custom JavaScript execution
 */
export async function fetchWithInteraction(url: string, strategy: ScrapingStrategy, apiKey: string): Promise<string> {
  try {
    console.log(`🎭 INTERACTIVE SCRAPING: ${url}`)
    console.log(`Strategy:`, JSON.stringify(strategy, null, 2))

    // Generate Puppeteer script from strategy
    const puppeteerScript = generatePuppeteerScript(url, strategy)
    console.log('📝 Generated Puppeteer script')

    // Use /function API for actual Puppeteer code execution
    const browserlessUrl = `https://chrome.browserless.io/function?token=${apiKey}&stealth=true&blockAds=true`

    const response = await fetch(browserlessUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/javascript',
      },
      body: puppeteerScript
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`Browserless function API error: ${response.status}`)
      console.error(`Error details: ${error}`)
      throw new Error(`Browserless function error: ${response.status} - ${error}`)
    }

    const html = await response.text()
    console.log(`✅ Interactive scraping complete: ${html.length} characters`)

    // Validate we got actual content, not just an error message
    if (html.length < 500) {
      console.warn(`⚠️ Suspiciously short response (${html.length} chars), may have failed`)
    }

    return html

  } catch (error) {
    console.error(`❌ Interactive scraping failed for ${url}:`, error)
    throw error // Re-throw so caller can handle fallback
  }
}
