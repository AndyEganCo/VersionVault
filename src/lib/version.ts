import { Software } from '@/data/software-list';

export function isMajorUpdate(software: Software): boolean {
  if (!software.currentVersion || !software.lastChecked) return false;

  // Get the major version number (e.g., 8 from 8.32)
  const currentMajor = parseInt(software.currentVersion.split('.')[0]);
  
  // Check if there was a previous version with a different major number
  const previousVersions = softwareVersionHistory.get(software.id) || [];
  if (previousVersions.length === 0) return false;

  const previousVersion = previousVersions[previousVersions.length - 1];
  const previousMajor = parseInt(previousVersion.split('.')[0]);

  return currentMajor > previousMajor;
}

export function getThisWeeksUpdates(software: Software[]): number {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return software.filter(s => {
    if (!s.lastChecked) return false;
    const updateDate = new Date(s.lastChecked);
    return updateDate >= oneWeekAgo;
  }).length;
}

// Mock version history data - in a real app, this would come from the database
const softwareVersionHistory = new Map<string, string[]>([
  ['propresenter', ['6.7', '7.0', '7.13']],
  ['resolume', ['7.16.0', '7.17.0']],
  ['protools', ['2023.12', '2024.3']],
  ['macos', ['13.6', '14.0', '14.4']],
  ['grandma3', ['1.9.3.2', '1.9.3.3']]
]);