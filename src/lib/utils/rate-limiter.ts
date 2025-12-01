/**
 * Simple client-side rate limiter to prevent spam
 */

interface RateLimitEntry {
  lastAttempt: number;
  count: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxAttempts: number;

  constructor(windowMs: number = 30000, maxAttempts: number = 1) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
  }

  /**
   * Check if an action is rate limited
   * @param key - Unique identifier for the action
   * @returns true if action is allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry) {
      // First attempt
      this.limits.set(key, { lastAttempt: now, count: 1 });
      return true;
    }

    const timeSinceLastAttempt = now - entry.lastAttempt;

    if (timeSinceLastAttempt > this.windowMs) {
      // Window has passed, reset
      this.limits.set(key, { lastAttempt: now, count: 1 });
      return true;
    }

    // Within window - check count
    if (entry.count >= this.maxAttempts) {
      return false;
    }

    // Increment count
    entry.count++;
    entry.lastAttempt = now;
    return true;
  }

  /**
   * Get remaining time until rate limit expires (in seconds)
   */
  getTimeRemaining(key: string): number {
    const entry = this.limits.get(key);
    if (!entry) return 0;

    const now = Date.now();
    const timeSinceLastAttempt = now - entry.lastAttempt;
    const remaining = this.windowMs - timeSinceLastAttempt;

    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Clear rate limit for a specific key
   */
  clear(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.limits.clear();
  }
}

// Create a singleton instance for version checks
// Rate limit: 1 check per 30 seconds per software
export const versionCheckLimiter = new RateLimiter(30000, 1);
