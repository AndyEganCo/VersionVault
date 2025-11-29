import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSoftwareList } from '@/lib/software/hooks';
import { LoadingPage } from '@/components/loading';
import { Search, ArrowRight, Bell, Zap, Shield, TrendingUp } from 'lucide-react';
import { categories } from '@/data/software-categories';

export function Home() {
  const { software, loading } = useSoftwareList();
  const [search, setSearch] = useState('');

  // Debug logging
  console.log('Home page - Loading:', loading, 'Software count:', software.length);

  const recentUpdates = useMemo(() => {
    return software
      .filter((s) => s.release_date)
      .sort((a, b) => {
        if (!a.release_date) return 1;
        if (!b.release_date) return -1;
        return new Date(b.release_date).getTime() - new Date(a.release_date).getTime();
      })
      .slice(0, 12);
  }, [software]);

  const softwareByCategory = useMemo(() => {
    const byCategory: Record<string, typeof software> = {};
    categories.forEach(category => {
      byCategory[category.value] = software.filter(s => s.category === category.value);
    });
    return byCategory;
  }, [software]);

  const filteredSoftware = useMemo(() => {
    if (!search) return software;
    return software.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.manufacturer.toLowerCase().includes(search.toLowerCase())
    );
  }, [software, search]);

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

  const SoftwareCard = ({ s }: { s: typeof software[0] }) => (
    <Card className="group hover:shadow-lg hover:border-primary/50 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
              {s.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground truncate">{s.manufacturer}</p>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {s.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Version</span>
            <Badge className="font-mono text-xs">{s.current_version || 'Unknown'}</Badge>
          </div>
          {s.release_date && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Released</span>
              <span className="text-xs">
                {new Date(s.release_date).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        <Link to="/signup" className="block">
          <Button
            variant="outline"
            size="sm"
            className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          >
            Track Software
          </Button>
        </Link>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative border-b bg-gradient-to-b from-background via-background to-muted/20">
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] [mask-image:radial-gradient(white,transparent_85%)]" />
        <div className="container relative mx-auto px-4 py-20 md:py-32">
          <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
            <div className="space-y-6">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Never Miss a Software Update
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
                Track {stats.totalSoftware}+ software versions in one place. Get notified when your tools release new versions.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/signup">
                <Button size="lg" className="gap-2 px-8">
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="px-8">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 pt-12 w-full max-w-2xl">
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  {stats.totalSoftware}+
                </div>
                <div className="text-sm text-muted-foreground">Software Tracked</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  {stats.recentUpdates}
                </div>
                <div className="text-sm text-muted-foreground">Updates This Week</div>
              </div>
              <div className="space-y-2">
                <div className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                  {stats.categories}
                </div>
                <div className="text-sm text-muted-foreground">Categories</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-lg bg-background/50 backdrop-blur">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <Bell className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Smart Notifications</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Get instant alerts when your tracked software releases new versions
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-lg bg-background/50 backdrop-blur">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Real-time Updates</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Automated version checking keeps you informed 24/7
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-lg bg-background/50 backdrop-blur">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <Shield className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Stay Secure</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Know when security patches are available for your tools
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Software Directory with Tabs */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="text-center space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold">Explore Software</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Browse our complete software directory with current version information
              </p>
            </div>

            {/* Search */}
            <div className="max-w-xl mx-auto">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search software by name or manufacturer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="recent" className="w-full">
              <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3 h-12">
                <TabsTrigger value="recent" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Recently Updated
                </TabsTrigger>
                <TabsTrigger value="categories">By Category</TabsTrigger>
                <TabsTrigger value="all">All Software</TabsTrigger>
              </TabsList>

              {/* Recently Updated Tab */}
              <TabsContent value="recent" className="mt-8 space-y-6">
                {recentUpdates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No recent updates available</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {recentUpdates.map((s) => (
                      <SoftwareCard key={s.id} s={s} />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* By Category Tab */}
              <TabsContent value="categories" className="mt-8 space-y-10">
                {categories.map((category) => {
                  const categorySoftware = softwareByCategory[category.value] || [];
                  if (categorySoftware.length === 0) return null;

                  return (
                    <div key={category.value} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-semibold">{category.label}</h3>
                        <Badge variant="secondary">{categorySoftware.length}</Badge>
                      </div>
                      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {categorySoftware.slice(0, 8).map((s) => (
                          <SoftwareCard key={s.id} s={s} />
                        ))}
                      </div>
                      {categorySoftware.length > 8 && (
                        <p className="text-sm text-muted-foreground text-center">
                          And {categorySoftware.length - 8} more...
                        </p>
                      )}
                    </div>
                  );
                })}
              </TabsContent>

              {/* All Software Tab */}
              <TabsContent value="all" className="mt-8 space-y-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredSoftware.length} software{search && ' matching your search'}
                  </p>
                </div>
                {filteredSoftware.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No software found matching your search</p>
                  </div>
                ) : (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredSoftware.map((s) => (
                      <SoftwareCard key={s.id} s={s} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-bold">
                Ready to Stay Updated?
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                Join VersionVault today and never miss an important software update again.
              </p>
            </div>
            <Link to="/signup">
              <Button size="lg" className="gap-2 px-8 h-12 text-base">
                Create Free Account
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
