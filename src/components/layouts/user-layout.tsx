import { Outlet } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { AuthCheck } from '@/components/auth/auth-check';

type UserLayoutProps = {
  children: React.ReactNode;
};

export function UserLayout({ children }: UserLayoutProps) {
  return <div>{children}</div>;
}