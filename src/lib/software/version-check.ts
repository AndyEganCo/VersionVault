export function compareVersions(current: SoftwareVersion, detected: SoftwareVersion): boolean {
  // Compare major version first
  if (detected.major > current.major) return true;
  if (detected.major < current.major) return false;
  
  // Compare build numbers if available
  if (detected.build && current.build) {
    return parseInt(detected.build) > parseInt(current.build);
  }
  
  // Compare minor/patch versions
  if (detected.minor && current.minor) {
    if (detected.minor > current.minor) return true;
    if (detected.minor < current.minor) return false;
  }
  
  return false;
} 