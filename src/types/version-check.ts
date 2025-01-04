export type VersionCheck = {
  id: string;
  user_id: string;
  software_id: string;
  software_name?: string;
  url: string;
  detected_version: string | null;
  current_version: string | null;
  status: 'success' | 'error';
  error?: string;
  checked_at: string;
  created_at: string;
};

export type VersionCheckStats = {
  total: number;
  successful: number;
  failed: number;
  newVersions: number;
};