import { UserNav } from '@/components/user/user-nav';
import { MainNav } from '@/components/main-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { Terminal } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from './ui/button';
import { Link } from 'react-router-dom';
import { PageContainer } from './layout/page-container';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <PageContainer>
          <div className="flex h-16 items-center gap-4">
            <Link to="/" className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              <span className="font-semibold">VersionVault</span>
            </Link>
            {user && <MainNav />}
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