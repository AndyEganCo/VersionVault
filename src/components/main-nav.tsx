import { cn } from '@/lib/utils';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { user, isAdmin } = useAuth();

  return (
    <nav
      className={cn('flex items-center space-x-4 lg:space-x-6', className)}
      {...props}
    >
      {user ? (
        <>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/software"
            className={({ isActive }) =>
              cn(
                'text-sm font-medium transition-colors hover:text-primary',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )
            }
          >
            Software
          </NavLink>
          {isAdmin && (
            <>
              <NavLink
                to="/admin/software"
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                Manage Software
              </NavLink>
              <NavLink
                to="/admin/requests"
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium transition-colors hover:text-primary',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )
                }
              >
                Requests
              </NavLink>
            </>
          )}
        </>
      ) : (
        <NavLink
          to="/"
          className={({ isActive }) =>
            cn(
              'text-sm font-medium transition-colors hover:text-primary',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
          end
        >
          Home
        </NavLink>
      )}
    </nav>
  );
}