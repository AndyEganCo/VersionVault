import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function AuthCheck() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for auth to initialize before redirecting
  if (loading) {
    return null;
  }

  // Only redirect after we know user is not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
