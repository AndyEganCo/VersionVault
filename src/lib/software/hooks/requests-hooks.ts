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
      let query = supabase
        .from('software_requests')
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

  const updateRequestStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('software_requests')
        .update({ status })
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
