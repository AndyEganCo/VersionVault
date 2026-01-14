import { UserNav } from '@/components/user/user-nav';
import { MainNav } from '@/components/main-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { Footer } from '@/components/footer';
import { Terminal, Menu, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Link, NavLink } from 'react-router-dom';
import { PageContainer } from './layout/page-container';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { navigationConfig, isSeparator } from '@/config/navigation';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <PageContainer>
          <div className="flex h-16 items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <span className="font-semibold">VersionVault</span>
              <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                BETA
              </Badge>
            </Link>

            {/* Desktop Navigation */}
            {user && <MainNav className="hidden md:flex" />}

            <div className="ml-auto flex items-center gap-2">
              <ModeToggle className="hidden md:flex" />
              {user ? (
                <>
                  <UserNav className="hidden md:flex" />

                  {/* Mobile Menu Button */}
                  <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="icon" className="md:hidden">
                        <Menu className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-64">
                      <div className="flex flex-col h-full">
                        {/* User Info */}
                        <div className="pb-4 mb-4 border-b">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                              <span className="text-sm font-medium">
                                {user.email?.[0]?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Account</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Navigation Links */}
                        <nav className="flex flex-col gap-2 mb-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 px-2">
                            NAVIGATION
                          </p>
                          {navigationConfig.main.map((item) => (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={({ isActive }) =>
                                cn(
                                  'text-sm font-medium transition-colors hover:text-primary px-3 py-2 rounded',
                                  isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                                )
                              }
                            >
                              {item.label}
                            </NavLink>
                          ))}
                        </nav>

                        {/* User Menu Items */}
                        <nav className="flex flex-col gap-2 mb-4">
                          <p className="text-xs font-semibold text-muted-foreground mb-1 px-2">
                            ACCOUNT
                          </p>
                          {navigationConfig.user.map((item) => {
                            const Icon = item.icon;
                            return (
                              <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary px-3 py-2 rounded hover:bg-accent transition-colors"
                              >
                                {Icon && <Icon className="h-4 w-4" />}
                                {item.label}
                              </Link>
                            );
                          })}
                        </nav>

                        {/* Admin Links */}
                        {isAdmin && (
                          <nav className="flex flex-col gap-2 mb-4">
                            <p className="text-xs font-semibold text-muted-foreground mb-1 px-2">
                              ADMIN
                            </p>
                            {navigationConfig.admin.map((item, index) =>
                              isSeparator(item) ? null : (
                                <NavLink
                                  key={item.path}
                                  to={item.path}
                                  onClick={() => setMobileMenuOpen(false)}
                                  className={({ isActive }) =>
                                    cn(
                                      'text-sm font-medium transition-colors hover:text-primary px-3 py-2 rounded',
                                      isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                                    )
                                  }
                                >
                                  {item.label}
                                </NavLink>
                              )
                            )}
                          </nav>
                        )}

                        {/* Dark Mode Toggle & Sign Out at Bottom */}
                        <div className="mt-auto pt-4 border-t space-y-2">
                          <button
                            onClick={toggleTheme}
                            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary px-3 py-2 rounded hover:bg-accent transition-colors w-full"
                          >
                            {theme === 'dark' ? (
                              <>
                                <Sun className="h-4 w-4" />
                                Light Mode
                              </>
                            ) : (
                              <>
                                <Moon className="h-4 w-4" />
                                Dark Mode
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              signOut();
                              setMobileMenuOpen(false);
                            }}
                            className="flex items-center gap-2 text-sm font-medium text-destructive hover:text-destructive px-3 py-2 rounded hover:bg-accent transition-colors w-full"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
              )}
            </div>
          </div>
        </PageContainer>
      </header>

      <main className="flex-1">
        <PageContainer className="py-6">
          {children}
        </PageContainer>
      </main>

      <Footer />
    </div>
  );
}