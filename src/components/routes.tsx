import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import { AuthCheck } from './auth/auth-check';
import { AdminCheck } from './auth/admin-check';
import { Dashboard } from '@/pages/dashboard';
import { Login } from '@/pages/login';
import { Software } from '@/pages/software';
import { UserLayout } from '@/components/layouts/user-layout';
import { UserProfile } from '@/pages/user/profile';
import { UserSettings } from '@/pages/user/settings';
import { UserNotifications } from '@/pages/user/notifications';
import { Signup } from '@/pages/signup';
import { AdminSoftware } from '@/pages/admin/software';
import { AdminVersionChecks } from '@/pages/admin/version-checks';

export function Routes() {
  return (
    <RouterRoutes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Protected routes */}
      <Route element={<AuthCheck />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/software" element={<Software />} />
        
        {/* User routes */}
        <Route path="/user" element={<UserLayout />}>
          <Route path="profile" element={<UserProfile />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="notifications" element={<UserNotifications />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={<AdminCheck />}>
          <Route index element={<Navigate to="software" replace />} />
          <Route path="software" element={<AdminSoftware />} />
          <Route path="version-checks" element={<AdminVersionChecks />} />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </RouterRoutes>
  );
}