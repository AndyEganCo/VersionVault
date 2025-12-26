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
  const hasCustomScript = !!strategy.customScript
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

    ${hasCustomScript ? `
    // Custom script used - return text content directly (what the script waited for)
    const text = await page.evaluate(() => document.body.innerText);
    console.log(\`✅ Scraping complete (text content): \${text.length} characters\`);
    return text;
    ` : `
    // Get final HTML
    const html = await page.content();
    console.log(\`✅ Scraping complete (HTML): \${html.length} characters\`);
    return html;
    `}
`

  // Add final return statement outside template
  script += `
  } catch (error) {
    console.error('❌ Interactive scraping error:', error);
    // Return whatever content we have
    ${hasCustomScript ? `
    const text = await page.evaluate(() => document.body.innerText || '');
    return text;
    ` : `
    const html = await page.content();
    return html;
    `}
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
export async function fetchWithInteraction(
  url: string,
  strategy: ScrapingStrategy,
  browserlessApiKey?: string
): Promise<string> {
  if (!browserlessApiKey) {
    throw new Error('Browserless API key required for interactive scraping')
  }

  console.log(`🎭 INTERACTIVE SCRAPING: ${url}`)
  console.log(`Strategy:`, JSON.stringify(strategy))

  const code = generatePuppeteerScript(url, strategy)

  // When using customScript, we return text content directly, not HTML
  const returnsText = !!strategy.customScript
  console.log(`📝 Generated Puppeteer script${returnsText ? ' (returns text)' : ' (returns HTML)'}`)

  try {
    const response = await fetch('https://chrome.browserless.io/function', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${browserlessApiKey}`,
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Browserless /function error: ${response.status}`, errorText)
      throw new Error(`Browserless /function returned ${response.status}: ${errorText}`)
    }

    const result = await response.text()
    console.log(`✅ Interactive scraping complete: ${result.length} characters`)

    // If we got text content directly, wrap it in minimal HTML for compatibility
    if (returnsText) {
      return `<html><body>${result}</body></html>`
    }

    return result

  } catch (error) {
    console.error('❌ Fetch error:', error)
    throw error
  }
}