import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { useSoftwareRequests } from '@/lib/software/requests-hooks';
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
import { Check, X, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function SoftwareRequests() {
  const { isAdmin } = useAuth();
  const { requests, loading, updateRequestStatus, deleteRequest } = useSoftwareRequests();

  const handleApprove = async (id: string) => {
    const success = await updateRequestStatus(id, 'approved');
    if (success) {
      toast.success('Request approved');
    } else {
      toast.error('Failed to approve request');
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

  if (loading) {
    return <LoadingPage />;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Software Requests"
        description={isAdmin ? "Manage software tracking requests" : "View your software tracking requests"}
      />

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
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleReject(request.id)}
                      className="flex items-center gap-1"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
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
    </PageLayout>
  );
}
