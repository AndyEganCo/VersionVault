import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { UserTrackingInfo, SoftwareTrackingCount } from '../types';
import { toggleSoftwareTracking } from '../utils/tracking';
import { toast } from 'sonner';

export function useSoftwareTrackingCounts() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) {
      setCounts(new Map());
      setLoading(false);
      return;
    }

    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase.rpc('get_software_tracking_counts');
        if (error) throw error;

        const countMap = new Map<string, number>();
        data?.forEach((row: SoftwareTrackingCount) => {
          countMap.set(row.software_id, row.tracking_count);
        });
        setCounts(countMap);
      } catch (error) {
        console.error('Error fetching tracking counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [isAdmin]);

  return { counts, loading };
}

export function useTrackingUsers(softwareId: string | null) {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserTrackingInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!softwareId || !isAdmin) {
      setUsers([]);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_all_users_with_tracking_status', {
        p_software_id: softwareId
      });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [softwareId, isAdmin]);

  const toggleTracking = async (userId: string, isTracking: boolean): Promise<boolean> => {
    if (!softwareId) return false;

    try {
      const success = await toggleSoftwareTracking(userId, softwareId, !isTracking);
      if (success) {
        toast.success(isTracking ? 'User untracked' : 'User is now tracking this software');
        await fetchUsers(); // Refresh list
      }
      return success;
    } catch (error) {
      console.error('Error toggling tracking:', error);
      toast.error('Failed to update tracking');
      return false;
    }
  };

  return { users, loading, fetchUsers, toggleTracking };
}
