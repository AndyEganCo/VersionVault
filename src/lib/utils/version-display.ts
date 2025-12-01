/**
 * Insert zero-width spaces between digits to prevent phone number detection
 *
 * This breaks browser/extension pattern matching while keeping text visually identical.
 * For example, "2025.31760" becomes "2​0​2​5​.​3​1​7​6​0​" (with invisible zero-width spaces)
 *
 * @param version - The version string to process
 * @returns The version string with zero-width spaces inserted after each digit
 */
export function breakPhonePattern(version: string): string {
  // Insert zero-width space (U+200B) after each digit
  return version.split('').map((char) => {
    if (/\d/.test(char)) {
      return char + '\u200B'; // Add zero-width space after each digit
    }
    return char;
  }).join('');
}
