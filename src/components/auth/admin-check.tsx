import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/ui/loading-screen';

export function AdminCheck() {
  const { user, isAdmin, loading } = useAuth();

  // Show loading screen while auth state is being determined
  if (loading) {
    return <LoadingScreen />;
  }

  // Only redirect after we know user is not admin
  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
