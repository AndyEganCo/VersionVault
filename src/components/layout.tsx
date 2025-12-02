import { UserNav } from '@/components/user/user-nav';
import { MainNav } from '@/components/main-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { Terminal, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Link, NavLink } from 'react-router-dom';
import { PageContainer } from './layout/page-container';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <PageContainer>
          <div className="flex h-16 items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <span className="font-semibold">VersionVault</span>
            </Link>

            {/* Desktop Navigation */}
            {user && <MainNav className="hidden md:flex" />}

            {/* Mobile Menu Button */}
            {user && (
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64">
                  <nav className="flex flex-col gap-4 mt-8">
                    <NavLink
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'text-sm font-medium transition-colors hover:text-primary px-2 py-2 rounded',
                          isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                        )
                      }
                    >
                      Dashboard
                    </NavLink>
                    <NavLink
                      to="/software"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'text-sm font-medium transition-colors hover:text-primary px-2 py-2 rounded',
                          isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                        )
                      }
                    >
                      Software
                    </NavLink>
                    {isAdmin && (
                      <>
                        <div className="border-t my-2" />
                        <NavLink
                          to="/admin/software"
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'text-sm font-medium transition-colors hover:text-primary px-2 py-2 rounded',
                              isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                            )
                          }
                        >
                          Manage Software
                        </NavLink>
                        <NavLink
                          to="/admin/users"
                          onClick={() => setMobileMenuOpen(false)}
                          className={({ isActive }) =>
                            cn(
                              'text-sm font-medium transition-colors hover:text-primary px-2 py-2 rounded',
                              isActive ? 'text-primary bg-accent' : 'text-muted-foreground'
                            )
                          }
                        >
                          Manage Users
                        </NavLink>
                      </>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            <div className="ml-auto flex items-center gap-2">
              <ModeToggle />
              {user ? (
                <UserNav />
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link to="/login">Sign In</Link>
                </Button>
              )}
            </div>
          </div>
        </PageContainer>
      </header>

      <main className="min-h-[calc(100vh-4rem)]">
        <PageContainer className="py-6">
          {children}
        </PageContainer>
      </main>
    </div>
  );
}