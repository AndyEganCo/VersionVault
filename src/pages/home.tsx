import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSoftwareList } from '@/lib/software/hooks';
import { LoadingPage } from '@/components/loading';
import { Search, ArrowRight, Bell, Zap, Shield, Calendar } from 'lucide-react';
import { categories } from '@/data/software-categories';

export function Home() {
  const { software, loading } = useSoftwareList();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredSoftware = useMemo(() => {
    return software.filter((s) => {
      const matchesSearch =
        search === '' ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.manufacturer.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [software, search, selectedCategory]);

  const recentUpdates = useMemo(() => {
    return software
      .filter((s) => s.release_date)
      .sort((a, b) => {
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
      })
      .slice(0, 5);
  }, [software]);

  const stats = {
    totalSoftware: software.length,
    recentUpdates: software.filter((s) => {
      if (!s.release_date) return false;
      const date = new Date(s.release_date);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return date >= weekAgo;
    }).length,
    categories: new Set(software.map((s) => s.category)).size,
  };

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <section className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-8">
            <div className="space-y-4 max-w-3xl">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                Never Miss a Software Update
              </h1>
              <p className="text-xl text-muted-foreground md:text-2xl">
                Track {stats.totalSoftware}+ software versions in one place. Get notified when your tools release new versions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button size="lg" className="gap-2">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-8 w-full max-w-2xl">
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.totalSoftware}+</div>
                <div className="text-sm text-muted-foreground">Software Tracked</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.recentUpdates}</div>
                <div className="text-sm text-muted-foreground">Updates This Week</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">{stats.categories}</div>
                <div className="text-sm text-muted-foreground">Categories</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="border-b py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bell className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Smart Notifications</h3>
              <p className="text-sm text-muted-foreground">
                Get instant alerts when your tracked software releases new versions
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Real-time Updates</h3>
              <p className="text-sm text-muted-foreground">
                Automated version checking keeps you informed 24/7
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Stay Secure</h3>
              <p className="text-sm text-muted-foreground">
                Know when security patches are available for your tools
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Software Directory */}
      <section className="py-12">
        <div className="container mx-auto px-4 space-y-8">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Software Directory</h2>
            <p className="text-muted-foreground">
              Browse all tracked software and their current versions
            </p>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search software..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={selectedCategory === null ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(null)}
                size="sm"
              >
                All
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.value}
                  variant={selectedCategory === category.value ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(category.value)}
                  size="sm"
                >
                  {category.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Recent Updates Highlight */}
          {search === '' && selectedCategory === null && recentUpdates.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">Recently Updated</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {recentUpdates.map((s) => (
                  <Card key={s.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{s.manufacturer}</p>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Version</span>
                        <Badge variant="secondary">{s.current_version || 'N/A'}</Badge>
                      </div>
                      {s.release_date && (
                        <div className="text-xs text-muted-foreground">
                          {new Date(s.release_date).toLocaleDateString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Software Grid */}
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">
              {selectedCategory ? `${categories.find(c => c.value === selectedCategory)?.label} Software` : 'All Software'}
              <span className="text-muted-foreground ml-2">({filteredSoftware.length})</span>
            </h3>

            {filteredSoftware.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No software found matching your criteria</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSoftware.map((s) => (
                  <Card key={s.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <CardTitle className="text-lg">{s.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{s.manufacturer}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {s.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Current Version</span>
                          <Badge className="font-mono">{s.current_version || 'Unknown'}</Badge>
                        </div>
                        {s.release_date && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Released</span>
                            <span className="text-sm">
                              {new Date(s.release_date).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                      <Link to="/signup" className="block">
                        <Button variant="outline" size="sm" className="w-full">
                          Track This Software
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Stay Updated?
            </h2>
            <p className="text-lg text-muted-foreground">
              Join VersionVault today and never miss an important software update again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="gap-2">
                  Create Free Account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
