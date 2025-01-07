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
  timestamp: string;
  error?: string;
  content?: string;
};

export type ScrapeStatus = {
  success: boolean;
  version: string | null;
  content: string;
  softwareName?: string;
  currentVersion?: string;
  error?: string;
  source: string;
  confidence: number;
  timestamp: string;
};