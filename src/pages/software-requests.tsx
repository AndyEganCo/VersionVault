import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useSoftwareRequests } from '@/lib/software/hooks/requests-hooks';
import { useFeatureRequests } from '@/lib/software/hooks/feature-requests-hooks';
import { useAuth } from '@/contexts/auth-context';
import { LoadingPage } from '@/components/loading';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, Trash2, ExternalLink, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { extractSoftwareInfo } from '@/lib/ai/extract-software-info';
import { RequestSoftwareModal } from '@/components/software/request-software-modal';
import { RequestFeatureModal } from '@/components/software/request-feature-modal';

export function SoftwareRequests() {
  const { isAdmin } = useAuth();
  const { requests, loading, updateRequestStatus, deleteRequest, refreshRequests } = useSoftwareRequests();
  const {
    requests: featureRequests,
    loading: featureLoading,
    updateRequestStatus: updateFeatureStatus,
    deleteRequest: deleteFeatureRequest,
    refetch: refetchFeatures
  } = useFeatureRequests();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    // Find the request to get its details
    const request = requests.find(r => r.id === id);
    if (!request) {
      toast.error('Request not found');
      return;
    }

    // Confirm with admin
    if (!confirm(`Approve "${request.name}" and automatically add it to the software tracking list?\n\nThis will use AI to extract manufacturer and category information.`)) {
      return;
    }

    setProcessingId(id);
    const loadingToast = toast.loading('Processing request with AI...');

    try {
      // Step 1: Extract manufacturer and category using AI
      toast.loading('Extracting software information...', { id: loadingToast });
      const extracted = await extractSoftwareInfo(
        request.name,
        request.website,
        request.version_url,
        request.description
      );

      // Step 2: Add software to tracking list
      toast.loading('Adding to software tracking list...', { id: loadingToast });
      const { error: insertError } = await supabase
        .from('software')
        .insert([{
          id: crypto.randomUUID(),
          name: request.name,
          manufacturer: extracted.manufacturer,
          website: request.website,
          version_website: request.version_url,
          category: extracted.category,
          current_version: extracted.currentVersion || null,
          release_date: extracted.releaseDate || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);

      if (insertError) {
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          toast.error('This software is already in the tracking list', { id: loadingToast });
          return;
        }
        throw insertError;
      }

      // Step 3: Update request status to approved
      toast.loading('Updating request status...', { id: loadingToast });
      const success = await updateRequestStatus(id, 'approved');

      if (!success) {
        toast.error('Software added but failed to update request status', { id: loadingToast });
        return;
      }

      // Success!
      const successDetails = [
        `Manufacturer: ${extracted.manufacturer}`,
        `Category: ${extracted.category}`,
        extracted.currentVersion && `Version: ${extracted.currentVersion}`,
        extracted.releaseDate && `Released: ${extracted.releaseDate}`
      ].filter(Boolean).join('\n');

      toast.success(
        `✅ ${request.name} approved and added to tracking!\n\n${successDetails}`,
        { id: loadingToast, duration: 5000 }
      );
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to process request. Please try again.', { id: loadingToast });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const success = await updateRequestStatus(id, 'rejected');
    if (success) {
      toast.success('Request rejected');
    } else {
      toast.error('Failed to reject request');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this request?')) {
      const success = await deleteRequest(id);
      if (success) {
        toast.success('Request deleted');
      } else {
        toast.error('Failed to delete request');
      }
    }
  };

  // Feature request handlers
  const handleFeatureApprove = async (id: string) => {
    const success = await updateFeatureStatus(id, 'approved');
    if (success) {
      toast.success('Feature request approved');
    } else {
      toast.error('Failed to approve feature request');
    }
  };

  const handleFeatureReject = async (id: string) => {
    const success = await updateFeatureStatus(id, 'rejected');
    if (success) {
      toast.success('Feature request rejected');
    } else {
      toast.error('Failed to reject feature request');
    }
  };

  const handleFeatureComplete = async (id: string) => {
    const success = await updateFeatureStatus(id, 'completed');
    if (success) {
      toast.success('Feature request marked as completed');
    } else {
      toast.error('Failed to update feature request');
    }
  };

  const handleFeatureDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this feature request?')) {
      const success = await deleteFeatureRequest(id);
      if (success) {
        toast.success('Feature request deleted');
      } else {
        toast.error('Failed to delete feature request');
      }
    }
  };

  if (loading || featureLoading) {
    return <LoadingPage />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">Completed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Requests"
        description={isAdmin ? "Manage user requests" : "View and submit your requests"}
      />

      <Tabs defaultValue="software" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="software">Software Requests</TabsTrigger>
          <TabsTrigger value="features">Feature Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="software" className="space-y-4">
          <div className="flex justify-end">
            <RequestSoftwareModal onSuccess={refreshRequests} />
          </div>

          <div className="space-y-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">
                {isAdmin
                  ? "No software requests found"
                  : "You haven't submitted any software requests yet"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle>{request.name}</CardTitle>
                    <CardDescription>
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Website:</span>
                    <a
                      href={request.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {request.website}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Version URL:</span>
                    <a
                      href={request.version_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {request.version_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {request.description && (
                    <div className="space-y-1">
                      <span className="text-sm font-medium">Description:</span>
                      <p className="text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>
                  )}
                </div>

                {isAdmin && request.status === 'pending' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request.id)}
                      className="flex items-center gap-1"
                      disabled={processingId === request.id}
                    >
                      {processingId === request.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4" />
                          Approve & Add
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(request.id)}
                      className="flex items-center gap-1"
                      disabled={processingId === request.id}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {isAdmin && request.status === 'approved' && (
                  <div className="border-t pt-4 mt-4 bg-green-50 dark:bg-green-950 p-3 rounded">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      ✅ Approved and added to software tracking
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      This software is now being tracked. You can view it in the Software page.
                    </p>
                  </div>
                )}

                {(isAdmin || request.status !== 'pending') && (
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(request.id)}
                      className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="flex justify-end">
            <RequestFeatureModal onSuccess={refetchFeatures} />
          </div>

          <div className="space-y-4">
            {featureRequests.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    {isAdmin
                      ? "No feature requests found"
                      : "You haven't submitted any feature requests yet"
                    }
                  </p>
                </CardContent>
              </Card>
            ) : (
              featureRequests.map((request) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <CardTitle>{request.title}</CardTitle>
                        <CardDescription>
                          Submitted {new Date(request.created_at).toLocaleDateString()}
                          {request.category && ` • ${request.category}`}
                        </CardDescription>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="text-sm font-medium">Description:</span>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {request.description}
                        </p>
                      </div>
                    </div>

                    {isAdmin && request.status === 'pending' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleFeatureApprove(request.id)}
                          className="flex items-center gap-1"
                        >
                          <Check className="h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleFeatureReject(request.id)}
                          className="flex items-center gap-1"
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {isAdmin && request.status === 'approved' && (
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleFeatureComplete(request.id)}
                          className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark as Completed
                        </Button>
                      </div>
                    )}

                    {request.status === 'approved' && (
                      <div className="border-t pt-4 mt-4 bg-green-50 dark:bg-green-950 p-3 rounded">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">
                          ✅ Approved - This feature is planned for development
                        </p>
                      </div>
                    )}

                    {request.status === 'completed' && (
                      <div className="border-t pt-4 mt-4 bg-blue-50 dark:bg-blue-950 p-3 rounded">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                          🎉 Completed - This feature has been implemented
                        </p>
                      </div>
                    )}

                    {(isAdmin || request.status !== 'pending') && (
                      <div className="flex justify-end pt-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFeatureDelete(request.id)}
                          className="flex items-center gap-1 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
