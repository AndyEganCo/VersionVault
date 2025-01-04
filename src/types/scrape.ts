export type ScrapeStatus = {
  success: boolean;
  version: string | null;
  content: string;
  error?: string;
  softwareName?: string;
  currentVersion?: string;
};