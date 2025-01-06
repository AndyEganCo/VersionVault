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
  error?: string;
  softwareId?: string;
  content?: string;
  timestamp?: string;
  isBeta?: boolean;
  releaseDate?: string;
};

export type ScrapeStatus = {
  id?: string;
  software_id: string;
  url: string;
  detected_version: string | null;
  current_version: string | null;
  status: 'success' | 'error';
  error?: string;
  content?: string;
  source: string;
  confidence: number;
  checked_at: string;
  is_beta?: boolean;
  release_date?: string;
};