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

export interface VersionHistory {
  readonly id: string;
  readonly software_id: string;
  readonly version: string;
  readonly detected_at: string;
  readonly created_at: string;
  readonly notes: string[];
  readonly type: 'major' | 'minor' | 'patch';
  readonly release_date: string;
}