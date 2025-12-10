import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { useSoftwareList } from '@/lib/software/hooks';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ExternalLink, Search } from 'lucide-react';
import type { Software } from '@/lib/software/types';

export function Home() {
  const { user, loading } = useAuth();
  const { software, loading: softwareLoading } = useSoftwareList();
  const [search, setSearch] = useState('');
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);

  // If logged in, redirect to dashboard
  if (loading) {
    return null;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Filter software based on search
  const filteredSoftware = software.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.manufacturer.toLowerCase().includes(search.toLowerCase())
  );

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

        {/* Software Browse Section */}
        {!softwareLoading && software.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">
                Browse {software.length} Software Applications
              </h2>
              <p className="text-muted-foreground">
                Search and explore software you can start tracking
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search software..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            {filteredSoftware.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredSoftware.map((item) => (
                  <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => setSelectedSoftware(item)}
                  >
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
                      {(item.release_date || item.last_checked) && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{item.release_date ? 'Released:' : 'Added:'}</span>
                          <span className="text-sm font-medium">
                            {new Date(item.release_date || item.last_checked).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground pt-2">
                        Click to view details
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  No software found matching "{search}"
                </p>
              </div>
            )}

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Sign up to start tracking software and get notified of updates
              </p>
              <Button asChild>
                <Link to="/signup">
                  Create Free Account
                </Link>
              </Button>
            </div>
          </div>
        )}

        {selectedSoftware && (
          <SoftwareDetailModal
            open={!!selectedSoftware}
            onOpenChange={(open) => !open && setSelectedSoftware(null)}
            software={selectedSoftware}
          />
        )}
      </div>
    </div>
  );
}
