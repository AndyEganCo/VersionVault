import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';

export interface SoftwareRequestWithId {
  readonly id: string;
  readonly name: string;
  readonly website: string;
  readonly version_url: string;
  readonly description?: string;
  readonly user_id: string;
  readonly status: 'pending' | 'approved' | 'rejected';
  readonly created_at: string;
  readonly rejection_reason?: string;
  readonly approved_at?: string;
  readonly rejected_at?: string;
  readonly approved_by?: string;
  readonly rejected_by?: string;
  readonly software_id?: string;
  // User info from join (for admin view)
  readonly user_email?: string;
  readonly user_name?: string;
}

export function useSoftwareRequests() {
  const { user, isAdmin } = useAuth();
  const [requests, setRequests] = useState<SoftwareRequestWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!user) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      // Only show loading state on initial load, not on refetches
      if (isInitialLoad) {
        setLoading(true);
      }

      // Use view with user info if admin, otherwise use regular table
      const tableName = isAdmin ? 'software_requests_with_user' : 'software_requests';

      let query = supabase
        .from(tableName)
        .select('*');

      // If not admin, only show user's own requests
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error) {
      console.error('Error fetching software requests:', error);
      setRequests([]);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [user, isAdmin, isInitialLoad]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const updateRequestStatus = async (
    id: string,
    status: 'approved' | 'rejected',
    rejectionReason?: string
  ) => {
    try {
      const updateData: any = {
        status,
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
      }

      const { error } = await supabase
        .from('software_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error updating request status:', error);
      return false;
    }
  };

  const deleteRequest = async (id: string) => {
    try {
      const { error } = await supabase
        .from('software_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchRequests();
      return true;
    } catch (error) {
      console.error('Error deleting request:', error);
      return false;
    }
  };

  return {
    requests,
    loading,
    refreshRequests: fetchRequests,
    updateRequestStatus,
    deleteRequest,
  };
}
