import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function AdminCheck() {
  const { user, isAdmin, loading } = useAuth();

  // Wait for auth to initialize before redirecting
  if (loading) {
    return null;
  }

  // Only redirect after we know user is not admin
  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
