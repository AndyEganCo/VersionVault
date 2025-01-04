import { z } from 'zod';
import { softwareCategories } from '@/data/software-categories';

export const ReleaseNoteSchema = z.object({
  version: z.string(),
  date: z.string(),
  notes: z.array(z.string()),
  type: z.enum(['major', 'minor', 'patch'])
});

export const SoftwareSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(Object.values(softwareCategories) as [string, ...string[]]),
  manufacturer: z.string(),
  website: z.string().url(),
  current_version: z.string().optional(),
  last_checked: z.string().optional(),
  tracked: z.boolean(),
  selected: z.boolean().optional()
});

export type ReleaseNote = z.infer<typeof ReleaseNoteSchema>;
export type Software = z.infer<typeof SoftwareSchema>;