import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function AuthCheck() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Only redirect once we KNOW user is not logged in (after auth loads)
  if (!loading && !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}