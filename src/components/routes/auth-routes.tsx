import { Navigate, Route, Routes } from 'react-router-dom';
import { Login } from '@/pages/login';
import { useAuth } from '@/contexts/auth-context';

export function AuthRoutes() {
  const { user } = useAuth();

  // Redirect to dashboard if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}