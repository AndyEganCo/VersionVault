export type ScrapeStatus = {
  success: boolean;
  version: string | null;
  source: string;
  content: string;
  confidence: number;
  softwareName?: string;
  currentVersion?: string;
  error?: string;
};