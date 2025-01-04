import { Outlet } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { AuthCheck } from '@/components/auth/auth-check';

export function UserLayout() {
  return (
    <AuthCheck>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Account Settings</h2>
          <p className="text-muted-foreground">
            Manage your account settings and preferences
          </p>
        </div>
        <Card className="p-6">
          <Outlet />
        </Card>
      </div>
    </AuthCheck>
  );
}