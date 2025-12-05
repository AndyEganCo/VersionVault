import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function AdminCheck() {
  const { user, isAdmin, loading } = useAuth();

  // Only redirect once we KNOW user is not admin (after auth loads)
  if (!loading && (!user || !isAdmin)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
} 