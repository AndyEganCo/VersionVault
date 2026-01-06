import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { useSoftwareList } from '@/lib/software/hooks/hooks';
import { SoftwareDetailModal } from '@/components/software/software-detail-modal';
import { AdBanner } from '@/components/dashboard/ad-banner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BetaBanner } from '@/components/beta-banner';
import { ExternalLink, Search, Mail, Bell, Sparkles, Clock, History } from 'lucide-react';
import type { Software } from '@/lib/software/types';
import { formatDate } from '@/lib/date';

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
      <div className="mx-auto max-w-6xl w-full space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6 pt-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Never Miss a Software Update
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Track the software you care about and receive automatic email notifications when new versions are released.
              Stay current without the constant checking.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button asChild size="lg" className="text-lg px-8 py-6">
              <Link to="/signup">
                Get Started Free
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8 py-6">
              <Link to="/login">
                Sign In
              </Link>
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Get started free. No credit card required.
          </p>
        </div>

        {/* Beta Banner */}
        <BetaBanner />

        {/* Features Section */}
        <div className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">How VersionVault Helps You</h2>
            <p className="text-muted-foreground">
              Everything you need to stay on top of your software stack
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Email Notifications */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Mail className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Email Digests</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Get beautiful email summaries of version updates on <strong>your schedule</strong> - daily, weekly, or monthly.
                  Only for the software you're tracking.
                </p>
              </CardContent>
            </Card>

            {/* AI-Powered Tracking */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">AI-Powered</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Our AI automatically detects version updates from official websites,
                  so you get accurate information directly from the source.
                </p>
              </CardContent>
            </Card>

            {/* Growing Catalog */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Search className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{software.length}+ Apps Tracked</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  From development tools to creative software, we track popular applications across all categories.
                  Don't see one? Request it!
                </p>
              </CardContent>
            </Card>

            {/* Time Saving */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Save Time</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Stop manually checking websites for updates. Let VersionVault do the work while you
                  focus on what matters.
                </p>
              </CardContent>
            </Card>

            {/* Customizable Notifications */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Your Preferences</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Choose your email frequency, timezone preferences, and which software to track.
                  Complete control over your notifications.
                </p>
              </CardContent>
            </Card>

            {/* Version History */}
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <History className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">Version History</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  View complete version history and release notes for all tracked software.
                  Never wonder when an update was released.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* How It Works */}
        <div className="space-y-8 bg-muted/30 rounded-lg p-8 md:p-12">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground">Get started in three simple steps</p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold">Browse & Select</h3>
              <p className="text-muted-foreground">
                Search our growing catalog and click "Track" on the software you use
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold">Set Your Preferences</h3>
              <p className="text-muted-foreground">
                Choose your email frequency - daily updates, weekly summaries, or monthly digests
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold">Stay Informed</h3>
              <p className="text-muted-foreground">
                Receive beautiful email notifications when your tracked software releases new versions
              </p>
            </div>
          </div>
        </div>

        {/* Ad Banner */}
        <AdBanner />

        {/* Software Browse Section */}
        {!softwareLoading && software.length > 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-2">
                Explore {software.length}+ Tracked Applications
              </h2>
              <p className="text-muted-foreground text-lg">
                Preview our catalog and see what you can start tracking today
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
                            {formatDate(item.release_date || item.last_checked)}
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

            <div className="text-center pt-8">
              <div className="bg-primary/5 rounded-lg p-8 space-y-4">
                <h3 className="text-2xl font-bold">Ready to Stay Updated?</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Join VersionVault today and never miss another important software update.
                  Start tracking your favorite applications in seconds.
                </p>
                <Button asChild size="lg" className="text-lg px-8 py-6">
                  <Link to="/signup">
                    Create Your Free Account
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  No credit card required • Start free • Upgrade anytime
                </p>
              </div>
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
