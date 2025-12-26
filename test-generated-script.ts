// Test what Puppeteer script gets generated
// Run with: deno run --allow-read test-generated-script.ts

import { generatePuppeteerScript } from './supabase/functions/_shared/interactive-scraping.ts'

const strategy = {
  customScript: 'await page.waitForFunction(() => { const text = document.body.innerText; return text.includes("December") && text.includes("Released") && text.length > 5000; }, {timeout: 30000});',
  waitTime: 3000
}

const url = 'https://support.zoom.us/hc/en-us/articles/207005927-Release-notes-for-Zoom-Rooms'

const script = generatePuppeteerScript(url, strategy)

console.log('====== GENERATED PUPPETEER SCRIPT ======')
console.log(script)
console.log('====== END SCRIPT ======')
console.log('')
console.log('Script length:', script.length, 'characters')

// Check for syntax issues
console.log('\nChecking for common syntax issues:')
const openBraces = (script.match(/{/g) || []).length
const closeBraces = (script.match(/}/g) || []).length
const openParens = (script.match(/\(/g) || []).length
const closeParens = (script.match(/\)/g) || []).length

console.log('  Open braces: ', openBraces)
console.log('  Close braces:', closeBraces)
console.log('  Match:', openBraces === closeBraces ? '✅' : '❌')
console.log('  Open parens: ', openParens)
console.log('  Close parens:', closeParens)
console.log('  Match:', openParens === closeParens ? '✅' : '❌')
