import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getAllSoftware } from './queries';
import { getTrackedSoftware } from './tracking';
import { toast } from 'sonner';
import type { Software } from './types';

export function useSoftwareList() {
  const [software, setSoftware] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSoftware = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllSoftware();
      setSoftware(data);
    } catch (error) {
      console.error('Error loading software:', error);
      toast.error('Failed to load software list');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSoftware();
  }, [refreshSoftware]);

  return { software, loading, refreshSoftware };
}

export function useTrackedSoftware() {
  const { user } = useAuth();
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refreshTracking = useCallback(async () => {
    if (!user) {
      setTrackedIds(new Set());
      setLoading(false);
      return;
    }

    try {
      const tracked = await getTrackedSoftware(user.id);
      setTrackedIds(tracked);
    } catch (error) {
      console.error('Error refreshing tracked software:', error);
      toast.error('Failed to load tracked software');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshTracking();
  }, [refreshTracking]);

  return { trackedIds, loading, refreshTracking };
}