import { z } from 'zod';

export const ReleaseNoteSchema = z.object({
  version: z.string(),
  date: z.string(),
  notes: z.array(z.string()),
  type: z.enum(['major', 'minor', 'patch'])
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;

export type Software = {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  website: string;
  tracked: boolean;
  selected?: boolean;
  current_version?: string;
  last_checked?: string;
  release_date?: string;
};

export type SoftwareUpdate = Partial<Software>;

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