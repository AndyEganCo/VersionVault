import { z } from 'zod';

export const ReleaseNoteSchema = z.object({
  version: z.string(),
  date: z.string(),
  notes: z.array(z.string()),
  type: z.enum(['major', 'minor', 'patch'])
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;

export type SourceType = 'webpage' | 'rss' | 'forum' | 'pdf';

export interface ForumConfig {
  forumType?: 'phpbb' | 'discourse' | 'generic';
  stickyOnly?: boolean;
  officialAuthor?: string;
  titlePattern?: string;
}

export interface Software {
  readonly id: string;
  readonly name: string;
  readonly manufacturer: string;
  readonly website: string;
  readonly category: string;
  readonly current_version?: string;
  readonly release_date?: string;
  readonly last_checked?: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly tracked?: boolean;
  readonly release_notes?: ReleaseNote[];
  version_website?: string;
  source_type?: SourceType;
  forum_config?: ForumConfig;
}

export interface SoftwareUpdate {
  readonly name?: string;
  readonly manufacturer?: string;
  readonly website?: string;
  readonly category?: string;
  readonly current_version?: string;
  readonly release_date?: string;
  readonly last_checked?: string;
}

export type SoftwareVersion = {
  major: number;
  minor?: number;
  patch?: number;
  build?: string;
  beta?: boolean;
  releaseDate?: string;
  features?: string[];
  changelog?: string;
};

export interface StructuredNotes {
  new_features?: string[];
  changes?: string[];
  improvements?: string[];
  bug_fixes?: string[];
  known_issues?: string[];
  notices?: string[];
  compatibility?: string[];
  upgrade_instructions?: string[];
}

export interface MergeMetadata {
  merged_at: string;
  had_manual_notes: boolean;
  sources_combined: string[];
  ai_model_used: string;
  merge_strategy: 'full' | 'partial' | 'manual_priority';
}

export interface VersionHistory {
  readonly id: string;
  readonly software_id: string;
  readonly version: string;
  readonly detected_at: string;
  readonly created_at: string;
  readonly notes: string[];
  readonly type: 'major' | 'minor' | 'patch';
  readonly release_date: string;
  readonly notes_source?: 'manual' | 'auto' | 'merged';
  readonly structured_notes?: StructuredNotes;
  readonly merge_metadata?: MergeMetadata;
  readonly search_sources?: string[];
  readonly notes_updated_at?: string;
}

export interface UserTrackingInfo {
  readonly user_id: string;
  readonly email: string;
  readonly display_name: string | null;
  readonly tracked_at: string;
  readonly is_admin: boolean;
  readonly is_premium: boolean;
}

export interface SoftwareTrackingCount {
  readonly software_id: string;
  readonly tracking_count: number;
}