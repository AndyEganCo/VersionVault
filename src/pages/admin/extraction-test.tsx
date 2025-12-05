import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ExtractionResult {
  mode: string;
  manufacturer?: string;
  category?: string;
  currentVersion?: string;
  releaseDate?: string;
  confidence?: number;
  productNameFound?: boolean;
  extractionMethod?: string;
  versions?: Array<{
    version: string;
    releaseDate?: string;
    notes?: string;
    type?: string;
  }>;
  validationResult?: {
    valid: boolean;
    confidence: number;
    reason: string;
    warnings: string[];
  };
  error?: string;
  duration?: number;
}

export function AdminExtractionTest() {
  // Form state
  const [name, setName] = useState('ATEM Switchers');
  const [manufacturer, setManufacturer] = useState('Blackmagic Design');
  const [website, setWebsite] = useState('https://www.blackmagicdesign.com');
  const [versionUrl, setVersionUrl] = useState('https://www.blackmagicdesign.com/support/family/atem-live-production-switchers');
  const [productIdentifier, setProductIdentifier] = useState('');
  const [scrapingStrategy, setScrapingStrategy] = useState('{\n  "releaseNotesSelectors": [".btn"],\n  "waitTime": 8000\n}');

  // Results state
  const [results, setResults] = useState<ExtractionResult[]>([]);
  const [loading, setLoading] = useState(false);

  const runTest = async (mode: 'legacy' | 'enhanced' | 'interactive') => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const body: any = {
        name,
        manufacturer,
        website,
        versionUrl,
      };

      if (productIdentifier) {
        body.productIdentifier = productIdentifier;
      }

      if (mode === 'interactive') {
        try {
          body.scrapingStrategy = JSON.parse(scrapingStrategy);
        } catch (e) {
          throw new Error('Invalid scraping strategy JSON');
        }
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-software-info`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(body),
        }
      );

      const duration = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();

      setResults(prev => [...prev, {
        mode,
        ...data,
        duration,
      }]);
    } catch (error: any) {
      setResults(prev => [...prev, {
        mode,
        error: error.message,
        duration: Date.now() - startTime,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const runAllTests = async () => {
    setResults([]);

    // Run legacy
    await runTest('legacy');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run enhanced
    await runTest('enhanced');

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Run interactive
    await runTest('interactive');
  };

  const clearResults = () => setResults([]);

  return (
    <PageLayout>
      <PageHeader
        title="Extraction Testing"
        description="Compare legacy vs enhanced vs interactive extraction modes"
      />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Test Parameters</CardTitle>
            <CardDescription>Enter software details to test extraction</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Software Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., ATEM Switchers"
              />
            </div>

            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Blackmagic Design"
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="versionUrl">Version URL</Label>
              <Input
                id="versionUrl"
                value={versionUrl}
                onChange={(e) => setVersionUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div>
              <Label htmlFor="productIdentifier">Product Identifier (optional)</Label>
              <Input
                id="productIdentifier"
                value={productIdentifier}
                onChange={(e) => setProductIdentifier(e.target.value)}
                placeholder="e.g., atem-switchers"
              />
            </div>

            <div>
              <Label htmlFor="scrapingStrategy">Scraping Strategy (for interactive mode)</Label>
              <Textarea
                id="scrapingStrategy"
                value={scrapingStrategy}
                onChange={(e) => setScrapingStrategy(e.target.value)}
                placeholder='{"releaseNotesSelectors": [".btn"], "waitTime": 8000}'
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={runAllTests}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run All Tests
                  </>
                )}
              </Button>

              {results.length > 0 && (
                <Button
                  variant="outline"
                  onClick={clearResults}
                  disabled={loading}
                >
                  Clear
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => runTest('legacy')}
                disabled={loading}
                className="flex-1"
              >
                Legacy Only
              </Button>
              <Button
                variant="outline"
                onClick={() => runTest('enhanced')}
                disabled={loading}
                className="flex-1"
              >
                Enhanced Only
              </Button>
              <Button
                variant="outline"
                onClick={() => runTest('interactive')}
                disabled={loading}
                className="flex-1"
              >
                Interactive Only
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Presets */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Presets</CardTitle>
            <CardDescription>Load common test cases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              onClick={() => {
                setName('ATEM Switchers');
                setManufacturer('Blackmagic Design');
                setWebsite('https://www.blackmagicdesign.com');
                setVersionUrl('https://www.blackmagicdesign.com/support/family/atem-live-production-switchers');
                setProductIdentifier('');
              }}
              className="w-full justify-start"
            >
              ATEM Switchers (Blackmagic)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setName('QLab');
                setManufacturer('Figure 53');
                setWebsite('https://qlab.app');
                setVersionUrl('https://qlab.app/downloads');
                setProductIdentifier('qlab');
              }}
              className="w-full justify-start"
            >
              QLab (Figure 53)
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setName('DaVinci Resolve');
                setManufacturer('Blackmagic Design');
                setWebsite('https://www.blackmagicdesign.com');
                setVersionUrl('https://www.blackmagicdesign.com/products/davinciresolve');
                setProductIdentifier('davinci-resolve');
              }}
              className="w-full justify-start"
            >
              DaVinci Resolve (Blackmagic)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-2xl font-bold">Results</h2>

          <div className="grid gap-4 md:grid-cols-3">
            {results.map((result, index) => (
              <Card key={index} className={result.error ? 'border-red-500' : ''}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      {result.mode === 'legacy' && '📊 Legacy'}
                      {result.mode === 'enhanced' && '🧠 Enhanced'}
                      {result.mode === 'interactive' && '🎭 Interactive'}
                    </CardTitle>
                    <Badge variant={result.error ? 'destructive' : 'default'}>
                      {result.duration}ms
                    </Badge>
                  </div>
                  <CardDescription>
                    Method: {result.extractionMethod || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.error ? (
                    <div className="text-red-500 text-sm">
                      <XCircle className="inline mr-2 h-4 w-4" />
                      {result.error}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        {result.productNameFound ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="text-sm">
                          Product Found: {result.productNameFound ? 'Yes' : 'No'}
                        </span>
                      </div>

                      <div>
                        <div className="text-sm font-medium">Version</div>
                        <div className="text-lg font-bold">
                          {result.currentVersion || 'Not found'}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium">Release Date</div>
                        <div>{result.releaseDate || 'N/A'}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">Confidence:</div>
                        <Badge variant={
                          (result.confidence || 0) >= 80 ? 'default' :
                          (result.confidence || 0) >= 60 ? 'secondary' : 'destructive'
                        }>
                          {result.confidence}%
                        </Badge>
                      </div>

                      {result.versions && result.versions.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-1">
                            Versions Found: {result.versions.length}
                          </div>
                          <div className="text-xs text-muted-foreground max-h-32 overflow-y-auto space-y-1">
                            {result.versions.slice(0, 5).map((v, i) => (
                              <div key={i} className="border-l-2 pl-2">
                                <div className="font-medium">{v.version}</div>
                                {v.notes && (
                                  <div className="text-xs truncate">{v.notes.substring(0, 60)}...</div>
                                )}
                              </div>
                            ))}
                            {result.versions.length > 5 && (
                              <div className="text-xs italic">
                                +{result.versions.length - 5} more...
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {result.validationResult && (
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          <div className="flex items-center gap-1">
                            {result.validationResult.valid ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-yellow-500" />
                            )}
                            {result.validationResult.reason}
                          </div>
                          {result.validationResult.warnings.length > 0 && (
                            <div className="mt-1 text-yellow-600">
                              ⚠️ {result.validationResult.warnings.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison Summary */}
          {results.length === 3 && !results.some(r => r.error) && (
            <Card className="mt-6 bg-muted">
              <CardHeader>
                <CardTitle>📊 Comparison Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Versions Found</div>
                    <div className="flex gap-4 mt-2">
                      <div>Legacy: {results[0].versions?.length || 0}</div>
                      <div>Enhanced: {results[1].versions?.length || 0}</div>
                      <div>Interactive: {results[2].versions?.length || 0}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Confidence</div>
                    <div className="flex gap-4 mt-2">
                      <div>Legacy: {results[0].confidence}%</div>
                      <div>Enhanced: {results[1].confidence}%</div>
                      <div>Interactive: {results[2].confidence}%</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Speed</div>
                    <div className="flex gap-4 mt-2">
                      <div>Legacy: {results[0].duration}ms</div>
                      <div>Enhanced: {results[1].duration}ms</div>
                      <div>Interactive: {results[2].duration}ms</div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-background rounded-md">
                  <div className="font-medium mb-2">💡 Analysis:</div>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    {(() => {
                      const versionsGain = (results[2].versions?.length || 0) - (results[0].versions?.length || 0);
                      const confidenceGain = (results[2].confidence || 0) - (results[0].confidence || 0);

                      return (
                        <>
                          {versionsGain > 0 && (
                            <li className="text-green-600">
                              Interactive found <strong>{versionsGain} more version(s)</strong> than legacy
                            </li>
                          )}
                          {confidenceGain > 0 && (
                            <li className="text-green-600">
                              Confidence improved by <strong>{confidenceGain}%</strong>
                            </li>
                          )}
                          {versionsGain === 0 && confidenceGain === 0 && (
                            <li className="text-yellow-600">
                              No significant improvement - legacy may be sufficient for this software
                            </li>
                          )}
                        </>
                      );
                    })()}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </PageLayout>
  );
}
