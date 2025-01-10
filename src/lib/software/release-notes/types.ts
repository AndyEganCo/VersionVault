export interface ReleaseNote {
  readonly version: string;
  readonly date: string;
  readonly notes: string[];
  readonly type: 'major' | 'minor' | 'patch';
} 