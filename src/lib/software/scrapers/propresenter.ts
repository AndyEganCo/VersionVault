export async function scrapeProPresenter(url: string): Promise<SoftwareVersion | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // Look for version in specific elements
    const versionElement = html.match(/VERSION\s*(\d+).*?\((\d+)\)/i);
    const dateElement = html.match(/(\w+ \d+,\s*\d{4})/);
    
    if (!versionElement) return null;

    return {
      major: parseInt(versionElement[1]),
      build: versionElement[2],
      beta: html.toLowerCase().includes('beta'),
      releaseDate: dateElement ? dateElement[1] : undefined,
      features: extractFeatures(html),
      changelog: extractChangelog(html)
    };
  } catch (error) {
    console.error('Error scraping ProPresenter:', error);
    return null;
  }
}

function extractFeatures(html: string): string[] {
  // Extract features from What's New section
  const features = [];
  const featureMatches = html.match(/What's new(.*?)What's improved/s);
  if (featureMatches) {
    // Parse feature bullets
    const featureList = featureMatches[1].match(/\*\*(.*?)\*\*/g);
    features.push(...(featureList || []).map(f => f.replace(/\*\*/g, '')));
  }
  return features;
}

function extractChangelog(html: string): string {
  // Extract changelog from What's Fixed section
  const changelogMatch = html.match(/What's fixed(.*?)(?=###|$)/si);
  return changelogMatch ? changelogMatch[1].trim() : '';
} 