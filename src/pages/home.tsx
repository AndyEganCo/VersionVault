import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { useSoftwareList } from '@/lib/software/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

export function Home() {
  const { user, loading } = useAuth();
  const { software, loading: softwareLoading } = useSoftwareList();

  // If logged in, redirect to dashboard
  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Show first 6 software items as preview
  const previewSoftware = software.slice(0, 6);

  return (
    <div className="flex flex-col px-4 py-8">
      <div className="mx-auto max-w-6xl w-full space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Welcome to VersionVault
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Track and manage software versions with ease. Stay up-to-date with the latest releases.
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

        {/* Software Preview Section */}
        {!softwareLoading && previewSoftware.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">
                Currently Tracking {software.length} Software Applications
              </h2>
              <p className="text-muted-foreground">
                Here's a preview of some software we're tracking
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {previewSoftware.map((item) => (
                <Card key={item.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{item.name}</CardTitle>
                        <CardDescription>{item.manufacturer}</CardDescription>
                      </div>
                      <Badge variant="secondary">{item.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {item.current_version && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Version:</span>
                        <span className="text-sm font-medium">{item.current_version}</span>
                      </div>
                    )}
                    {item.release_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Released:</span>
                        <span className="text-sm font-medium">
                          {new Date(item.release_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <a
                      href={item.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline pt-2"
                    >
                      Visit Website
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Sign up to track these and many more software applications
              </p>
              <Button asChild>
                <Link to="/signup">
                  Create Free Account
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
