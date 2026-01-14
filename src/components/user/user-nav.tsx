import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/auth-context';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navigationConfig } from '@/config/navigation';

interface UserNavProps {
  className?: string;
}

export function UserNav({ className }: UserNavProps) {
  const { user, signOut } = useAuth();

  if (!user) return null;

  const userInitial = user.email?.[0]?.toUpperCase() || 'U';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className={cn("relative h-8 w-8 rounded-full", className)}>
          {userInitial}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Account</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {navigationConfig.user.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex items-center cursor-pointer">
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {navigationConfig.user.slice(3).map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem key={item.path} asChild>
                <Link to={item.path} className="flex items-center cursor-pointer">
                  {Icon && <Icon className="mr-2 h-4 w-4" />}
                  {item.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}