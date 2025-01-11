export interface VersionCheckResult {
  version: string;
  releaseDate?: string;
  notes?: string[];
  type?: 'major' | 'minor' | 'patch';
}

export interface VersionChecker {
  check: () => Promise<VersionCheckResult>;
}