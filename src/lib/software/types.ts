import { z } from 'zod';

export const ReleaseNoteSchema = z.object({
  version: z.string(),
  date: z.string(),
  notes: z.array(z.string()),
  type: z.enum(['major', 'minor', 'patch'])
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;

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