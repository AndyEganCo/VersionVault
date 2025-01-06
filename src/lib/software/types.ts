import { z } from 'zod';
import { softwareCategories } from '@/data/software-categories';

export const ReleaseNoteSchema = z.object({
  version: z.string(),
  date: z.string(),
  notes: z.array(z.string()),
  type: z.enum(['major', 'minor', 'patch'])
});

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
};

export type SoftwareUpdate = Partial<Software>;

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;