export interface VersionCheckResult {
  softwareId: string;
  version: string;
  currentVersion?: string;
  error?: string;
  content?: string;
  source?: string;
  confidence?: number;
  timestamp?: string;
}

export interface VersionChecker {
  check: () => Promise<VersionCheckResult>;
}