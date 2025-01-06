import { Routes as RouterRoutes, Route, Outlet } from 'react-router-dom';
import { Dashboard } from '@/pages/dashboard';
import { Software } from '@/pages/software';
import { UserLayout } from '@/components/layouts/user-layout';
import { UserProfile } from '@/pages/user/profile';
import { UserSettings } from '@/pages/user/settings';
import { UserNotifications } from '@/pages/user/notifications';
import { Login } from '@/pages/login';
import { Signup } from '@/pages/signup';
import { AuthCheck } from '@/components/auth/auth-check';
import { AdminVersionChecks } from '@/pages/admin/version-checks';
import { AdminSoftware } from '@/pages/admin/software';

export function Routes() {
  return (
    <RouterRoutes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      
      {/* Public routes */}
      <Route path="/" element={<Dashboard />} />
      <Route path="/software" element={<Software />} />
      
      {/* Admin routes */}
      <Route path="/admin/software" element={<AdminSoftware />} />
      <Route path="/admin/version-checks" element={<AdminVersionChecks />} />
      
      {/* Protected user routes */}
      <Route element={<AuthCheck />}>
        <Route path="/user" element={<UserLayout>
          <Outlet />
        </UserLayout>}>
          <Route path="profile" element={<UserProfile />} />
          <Route path="settings" element={<UserSettings />} />
          <Route path="notifications" element={<UserNotifications />} />
        </Route>
      </Route>
    </RouterRoutes>
  );
}