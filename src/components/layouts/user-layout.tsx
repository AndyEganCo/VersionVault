import { ReactNode } from 'react';

type UserLayoutProps = {
  children: ReactNode;
};

export function UserLayout({ children }: UserLayoutProps) {
  return (
    <div className="space-y-6">
      {children}
    </div>
  );
}