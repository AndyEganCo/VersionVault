import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';

export interface FeatureRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  approved_at?: string;
  rejected_at?: string;
  completed_at?: string;
  approved_by?: string;
  rejected_by?: string;
  completed_by?: string;
  // User info from join (for admin view)
  user_email?: string;
  user_name?: string;
}

export function useFeatureRequests() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { user, isAdmin } = useAuth();

  const fetchRequests = async () => {
    try {
      // Only show loading state on initial load, not on refetches
      if (isInitialLoad) {
        setLoading(true);
      }

      // Use view with user info if admin, otherwise use regular table
      const tableName = isAdmin ? 'feature_requests_with_user' : 'feature_requests';

      let query = supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      // Non-admins only see their own requests
      if (!isAdmin && user) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching feature requests:', error);
      toast.error('Failed to load feature requests');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user, isAdmin]);

  const updateRequestStatus = async (
    id: string,
    status: 'approved' | 'rejected' | 'completed',
    rejectionReason?: string
  ): Promise<boolean> => {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Add metadata based on status
      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejected_by = user?.id;
        if (rejectionReason) {
          updateData.rejection_reason = rejectionReason;
        }
      } else if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id;
      }

      const { error } = await supabase
        .from('feature_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error updating feature request status:', error);
      return false;
    }
  };

  const deleteRequest = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error deleting feature request:', error);
      return false;
    }
  };

  return {
    requests,
    loading,
    updateRequestStatus,
    deleteRequest,
    refetch: fetchRequests,
  };
}
