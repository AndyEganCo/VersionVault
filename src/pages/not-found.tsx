import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Home, Search, ArrowLeft } from 'lucide-react';

export function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page Not Found - VersionVault</title>
        <meta name="description" content="The page you're looking for doesn't exist." />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="flex min-h-[600px] items-center justify-center px-4">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-9xl font-bold text-primary">404</h1>
            <h2 className="text-3xl font-semibold tracking-tight">
              Page Not Found
            </h2>
            <p className="text-muted-foreground">
              Sorry, we couldn't find the page you're looking for. It might have been moved or deleted.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild size="lg">
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/software">
                <Search className="mr-2 h-4 w-4" />
                Browse Software
              </Link>
            </Button>
          </div>

          <div className="pt-6 border-t">
            <p className="text-sm text-muted-foreground">
              Need help?{' '}
              <Link
                to="/"
                className="text-primary underline-offset-4 hover:underline"
              >
                Contact support
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
