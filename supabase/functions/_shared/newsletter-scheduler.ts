// Newsletter Scheduler Utilities
// Shared timezone and scheduling logic

/**
 * Calculate the next scheduled send time for a newsletter
 * Returns 8 AM in the user's timezone
 */
export function calculateScheduledTime(
  frequency: 'daily' | 'weekly' | 'monthly',
  timezone: string
): Date {
  const now = new Date()

  // Get current time in user's timezone
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
  const userHour = userNow.getHours()

  let scheduledDate = new Date(userNow)

  // Set to 8 AM
  scheduledDate.setHours(8, 0, 0, 0)

  // If it's already past 8 AM today, move to next period
  if (userHour >= 8) {
    switch (frequency) {
      case 'daily':
        scheduledDate.setDate(scheduledDate.getDate() + 1)
        break
      case 'weekly':
        // Next Monday
        const daysUntilMonday = (8 - scheduledDate.getDay()) % 7 || 7
        scheduledDate.setDate(scheduledDate.getDate() + daysUntilMonday)
        break
      case 'monthly':
        // Next 1st of month
        scheduledDate.setMonth(scheduledDate.getMonth() + 1, 1)
        break
    }
  } else {
    // Before 8 AM, check if today is valid for frequency
    switch (frequency) {
      case 'daily':
        // Send today
        break
      case 'weekly':
        // Only send on Mondays
        if (scheduledDate.getDay() !== 1) {
          const daysUntilMonday = (8 - scheduledDate.getDay()) % 7 || 7
          scheduledDate.setDate(scheduledDate.getDate() + daysUntilMonday)
        }
        break
      case 'monthly':
        // Only send on 1st
        if (scheduledDate.getDate() !== 1) {
          scheduledDate.setMonth(scheduledDate.getMonth() + 1, 1)
        }
        break
    }
  }

  // Convert user's local 8 AM back to UTC for storage
  const utcString = scheduledDate.toLocaleString('en-US', { timeZone: timezone })
  return new Date(utcString)
}

/**
 * Check if it's currently the target hour in a timezone
 */
export function isTargetHourInTimezone(
  timezone: string,
  targetHour: number = 8
): boolean {
  try {
    const now = new Date()
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return userTime.getHours() === targetHour
  } catch (error) {
    console.error(`Invalid timezone ${timezone}:`, error)
    return false
  }
}

/**
 * Get day of week in user's timezone (0 = Sunday, 1 = Monday, etc.)
 */
export function getDayOfWeekInTimezone(timezone: string): number {
  try {
    const now = new Date()
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return userTime.getDay()
  } catch (error) {
    console.error(`Invalid timezone ${timezone}:`, error)
    return -1
  }
}

/**
 * Get date (1-31) in user's timezone
 */
export function getDateInTimezone(timezone: string): number {
  try {
    const now = new Date()
    const userTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
    return userTime.getDate()
  } catch (error) {
    console.error(`Invalid timezone ${timezone}:`, error)
    return -1
  }
}

/**
 * Check if user should receive newsletter today based on frequency
 */
export function shouldSendToday(
  frequency: 'daily' | 'weekly' | 'monthly',
  timezone: string
): boolean {
  switch (frequency) {
    case 'daily':
      return true // Send every day

    case 'weekly':
      return getDayOfWeekInTimezone(timezone) === 1 // Monday only

    case 'monthly':
      return getDateInTimezone(timezone) === 1 // 1st of month only

    default:
      return false
  }
}

/**
 * Get number of days to look back based on frequency
 */
export function getSinceDays(frequency: 'daily' | 'weekly' | 'monthly'): number {
  switch (frequency) {
    case 'daily':
      return 1
    case 'weekly':
      return 7
    case 'monthly':
      return 30
    default:
      return 7
  }
}

/**
 * Generate idempotency key for queue entry
 */
export function generateIdempotencyKey(
  userId: string,
  frequency: string,
  date: Date = new Date()
): string {
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  return `${userId}-${frequency}_digest-${dateStr}`
}
