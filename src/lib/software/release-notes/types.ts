export type ReleaseNote = {
  version: string;
  date: string;
  notes: string[];
  type: 'major' | 'minor' | 'patch';
};