import { Link as RouterLink } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const Link = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RouterLink>) => {
  return (
    <RouterLink className={cn('text-primary hover:underline', className)} {...props}>
      {children}
    </RouterLink>
  );
};