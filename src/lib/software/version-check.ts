import type { Software } from './types';

export function compareVersions(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return true;
  if (!b) return false;
  
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || 0;
    const bPart = bParts[i] || 0;
    
    if (bPart > aPart) return true;
    if (bPart < aPart) return false;
  }
  
  return false;
} 