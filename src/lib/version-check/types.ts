export type ScrapeResult = {
  content: string;
  source: 'meta' | 'version-element' | 'download-section' | 'main-content' | 'body' | 'error';
};

export type VersionInfo = {
  version: string | null;
  confidence: 'high' | 'medium' | 'low';
};

export type CheckResult = {
  version: string | null;
  confidence: number;
  source: string;
  success?: boolean;
  error?: string;
  currentVersion?: string;
};

export type ScrapeStatus = CheckResult;