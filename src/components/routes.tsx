import { Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import { AuthCheck } from './auth/auth-check';
import { AdminCheck } from './auth/admin-check';
import { Dashboard } from '@/pages/dashboard';
import { Home } from '@/pages/home';
import { Login } from '@/pages/login';
import { Software } from '@/pages/software';
import { SoftwareRequests } from '@/pages/software-requests';
import { UserLayout } from '@/components/layouts/user-layout';
import { UserProfile } from '@/pages/user/profile';
import { UserSettings } from '@/pages/user/settings';
import { UserNotifications } from '@/pages/user/notifications';
import { Signup } from '@/pages/signup';
import { AdminSoftware } from '@/pages/admin/software';
import { AdminUsers } from '@/pages/admin/users';

export function Routes() {
  return (
    <RouterRoutes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Protected routes */}
      <Route element={<AuthCheck />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/software" element={<Software />} />
        <Route path="/requests" element={<SoftwareRequests />} />

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
          <Route path="users" element={<AdminUsers />} />
        </Route>
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </RouterRoutes>
  );
}