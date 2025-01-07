import { Outlet } from 'react-router-dom';

export type UserLayoutProps = {
  children?: React.ReactNode;
};

export function UserLayout() {
  return (
    <div className="container py-6">
      <Outlet />
    </div>
  );
}