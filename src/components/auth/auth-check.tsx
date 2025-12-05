import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/ui/loading-screen';

export function AuthCheck() {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading screen while auth state is being determined
  if (loading) {
    return <LoadingScreen />;
  }

  // Only redirect after we know user is not authenticated
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
