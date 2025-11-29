import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';

export function Home() {
  const { user, loading } = useAuth();

  // If logged in, redirect to dashboard
  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="flex min-h-[600px] flex-col items-center justify-center px-4">
      <div className="mx-auto max-w-2xl text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Welcome to VersionVault
          </h1>
          <p className="text-xl text-muted-foreground">
            Track and manage software versions with ease
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-lg text-muted-foreground">
            VersionVault helps you stay up-to-date with the latest software releases.
            Track your favorite applications, receive updates, and never miss an important version change.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          <Button asChild size="lg">
            <Link to="/signup">
              Get Started
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/login">
              Sign In
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
