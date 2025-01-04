import { z } from 'zod';
import { softwareCategories } from '@/data/software-categories';

export const SoftwareSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(Object.values(softwareCategories) as [string, ...string[]]),
  manufacturer: z.string(),
  website: z.string().url(),
  currentVersion: z.string().optional(),
  lastChecked: z.string().optional(),
  tracked: z.boolean()
});

export type ValidatedSoftware = z.infer<typeof SoftwareSchema>;

export function validateSoftware(software: unknown) {
  return SoftwareSchema.safeParse(software);
}

export function validateSoftwareList(list: unknown[]) {
  return z.array(SoftwareSchema).safeParse(list);
}