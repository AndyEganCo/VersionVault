import { showControlSoftware } from './categories/show-control';
import { audioSoftware } from './categories/audio';
import { lightingSoftware } from './categories/lighting';
import { designSoftware } from './categories/design';
import { networkSoftware } from './categories/network';
import { projectSoftware } from './categories/project';

export type Software = {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  website: string;
  currentVersion?: string;
  lastChecked?: string;
  tracked: boolean;
};

export const softwareList: Software[] = [
  ...showControlSoftware,
  ...audioSoftware,
  ...lightingSoftware,
  ...designSoftware,
  ...networkSoftware,
  ...projectSoftware
];