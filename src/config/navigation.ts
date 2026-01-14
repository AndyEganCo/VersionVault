import { LucideIcon, User, Bell, FileText, Heart } from 'lucide-react';

/**
 * Navigation item with path, label, and optional icon
 */
export type NavItem = {
  path: string;
  label: string;
  icon?: LucideIcon;
};

/**
 * Separator item for visual grouping in menus
 */
export type NavSeparator = {
  separator: true;
};

/**
 * Union type for all navigation items
 */
export type NavigationItem = NavItem | NavSeparator;

/**
 * Centralized navigation configuration
 * Single source of truth for all navigation links across desktop and mobile
 */
export const navigationConfig = {
  /**
   * Main navigation links (visible in top nav bar)
   */
  main: [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/software', label: 'Software' },
  ] as NavItem[],

  /**
   * User account navigation links (visible in user dropdown)
   */
  user: [
    { path: '/user/profile', label: 'Profile', icon: User },
    { path: '/user/notifications', label: 'Notifications', icon: Bell },
    { path: '/requests', label: 'Requests', icon: FileText },
    { path: '/user/contribute', label: 'Contribute', icon: Heart },
  ] as NavItem[],

  /**
   * Admin navigation links (visible only to admin users)
   * Includes separators for visual grouping
   */
  admin: [
    { path: '/admin/software', label: 'Manage Software' },
    { path: '/admin/users', label: 'Manage Users' },
    { path: '/admin/newsletter', label: 'Newsletter' },
    { separator: true },
    { path: '/admin/subscriptions', label: 'Subscriptions' },
    { path: '/admin/donations', label: 'Donations' },
  ] as NavigationItem[],
};

/**
 * Type guard to check if a navigation item is a separator
 */
export function isSeparator(item: NavigationItem): item is NavSeparator {
  return 'separator' in item && item.separator === true;
}
