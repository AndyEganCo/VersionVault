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
}

export function useFeatureRequests() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();

  const fetchRequests = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('feature_requests')
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user, isAdmin]);

  const updateRequestStatus = async (
    id: string,
    status: 'approved' | 'rejected' | 'completed'
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('feature_requests')
        .update({ status, updated_at: new Date().toISOString() })
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
