import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Check, X, ExternalLink } from 'lucide-react';
import { LoadingPage } from '@/components/loading';

interface SoftwareRequest {
  id: string;
  name: string;
  website: string;
  versionUrl: string;
  description: string | null;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  user_email?: string;
}

export function AdminSoftwareRequests() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<SoftwareRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    try {
      const { data, error } = await supabase
        .from('software_requests')
        .select('*')
        .order('createdAt', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error('Failed to load software requests');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(request: SoftwareRequest) {
    try {
      // Create the software entry
      const softwareId = `${request.name.toLowerCase().replace(/\s+/g, '-')}`;

      const { error: softwareError } = await supabase
        .from('software')
        .insert({
          id: softwareId,
          name: request.name,
          manufacturer: 'Unknown', // Can be updated later
          website: request.website,
          version_website: request.versionUrl,
          category: 'Project Management', // Default category
          current_version: null,
          release_date: null,
          last_checked: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (softwareError) {
        // If software already exists, just update the request status
        if (softwareError.code === '23505') {
          toast.error('Software with this ID already exists');
        } else {
          throw softwareError;
        }
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('software_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast.success(`${request.name} has been approved and added to the software list`);
      loadRequests();
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    }
  }

  async function handleReject(requestId: string) {
    try {
      const { error } = await supabase
        .from('software_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Request rejected');
      loadRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    }
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingPage />;
  }

  const filteredRequests = requests.filter(r => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  return (
    <PageLayout>
      <PageHeader
        title="Software Requests"
        description="Review and approve user-submitted software tracking requests"
      />

      <div className="space-y-6">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            onClick={() => setFilter('pending')}
            size="sm"
          >
            Pending ({requests.filter(r => r.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'approved' ? 'default' : 'outline'}
            onClick={() => setFilter('approved')}
            size="sm"
          >
            Approved ({requests.filter(r => r.status === 'approved').length})
          </Button>
          <Button
            variant={filter === 'rejected' ? 'default' : 'outline'}
            onClick={() => setFilter('rejected')}
            size="sm"
          >
            Rejected ({requests.filter(r => r.status === 'rejected').length})
          </Button>
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            onClick={() => setFilter('all')}
            size="sm"
          >
            All ({requests.length})
          </Button>
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No {filter !== 'all' ? filter : ''} requests found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {request.name}
                        <Badge
                          variant={
                            request.status === 'approved'
                              ? 'default'
                              : request.status === 'rejected'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {request.status}
                        </Badge>
                      </CardTitle>
                      <CardDescription>
                        Requested on {new Date(request.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <div>
                      <span className="text-sm font-medium">Official Website:</span>
                      <a
                        href={request.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {request.website}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div>
                      <span className="text-sm font-medium">Version Check URL:</span>
                      <a
                        href={request.versionUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {request.versionUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    {request.description && (
                      <div>
                        <span className="text-sm font-medium">Description:</span>
                        <p className="text-sm text-muted-foreground">{request.description}</p>
                      </div>
                    )}
                  </div>

                  {request.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleApprove(request)}
                        size="sm"
                        className="gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Approve & Add
                      </Button>
                      <Button
                        onClick={() => handleReject(request.id)}
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
