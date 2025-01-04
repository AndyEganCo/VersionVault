export type ScrapeResult = {
  content: string;
  source: 'meta' | 'version-element' | 'download-section' | 'main-content' | 'body' | 'error';
};

export type VersionInfo = {
  version: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export type CheckResult = {
  success: boolean;
  version: string | null;
  confidence: VersionInfo['confidence'];
  source: ScrapeResult['source'];
  content: string;
  error?: string;
  softwareName?: string;
  currentVersion?: string;
};