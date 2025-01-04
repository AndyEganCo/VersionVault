export function determineVersionType(oldVersion: string, newVersion: string): 'major' | 'minor' | 'patch' {
  const oldParts = oldVersion.replace(/^v/, '').split('.').map(Number);
  const newParts = newVersion.replace(/^v/, '').split('.').map(Number);

  if (newParts[0] > oldParts[0]) return 'major';
  if (newParts[1] > oldParts[1]) return 'minor';
  return 'patch';
}