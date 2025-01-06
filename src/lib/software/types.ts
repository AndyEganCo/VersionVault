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