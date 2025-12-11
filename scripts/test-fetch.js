// Test script to see what content we're actually fetching from COEX
const url = 'https://coex.wiki/en/Solution/en/Release-Note';

async function testFetch() {
  console.log(`Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VersionVault/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return;
    }

    const html = await response.text();
    console.log(`\n=== HTML LENGTH ===`);
    console.log(`${html.length} characters`);

    console.log(`\n=== FIRST 2000 CHARS ===`);
    console.log(html.substring(0, 2000));

    console.log(`\n=== SEARCHING FOR VERSION KEYWORDS ===`);
    const keywords = ['version', 'release', 'v1.', 'v2.', 'v3.', 'v4.', 'v5.', 'coex'];
    keywords.forEach(keyword => {
      const index = html.toLowerCase().indexOf(keyword);
      if (index !== -1) {
        console.log(`Found "${keyword}" at position ${index}`);
        console.log(`Context: ...${html.substring(Math.max(0, index - 50), index + 100)}...`);
      }
    });

    // Try to extract like our edge function does
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    console.log(`\n=== BODY TEXT (first 1000 chars) ===`);
    const bodyText = doc.body?.textContent || '';
    console.log(bodyText.substring(0, 1000));

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testFetch();
