import { cn } from '@/lib/utils';

type PageLayoutProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className={cn('space-y-6 w-full', className)}>
      {children}
    </div>
  );
}