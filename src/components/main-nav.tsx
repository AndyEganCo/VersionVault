import { cn } from '@/lib/utils';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { navigationConfig, isSeparator } from '@/config/navigation';

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <nav
      className={cn('flex items-center space-x-4 lg:space-x-6', className)}
      {...props}
    >
      {navigationConfig.main.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          {item.label}
        </NavLink>
      ))}
      {isAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              'flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary outline-none',
              isAdminRoute ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            Admin
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {navigationConfig.admin.map((item, index) =>
              isSeparator(item) ? (
                <DropdownMenuSeparator key={`separator-${index}`} />
              ) : (
                <DropdownMenuItem key={item.path} asChild>
                  <Link to={item.path} className="cursor-pointer">
                    {item.label}
                  </Link>
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}