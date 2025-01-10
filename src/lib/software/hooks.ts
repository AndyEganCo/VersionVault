import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getAllSoftware, getLatestVersionInfo } from './queries';
import { getTrackedSoftware } from './tracking';
import { toast } from 'sonner';
import type { Software } from './types';

export function useSoftwareList() {
  const [software, setSoftware] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshSoftware = useCallback(async () => {
    try {
      const data = await getAllSoftware();
      
      // Get latest version info for each software
      const softwareWithVersions = await Promise.all(
        data.map(async (s) => {
          const versionInfo = await getLatestVersionInfo(s.id);
          return {
            ...s,
            current_version: versionInfo.version || s.current_version,
            last_checked: versionInfo.last_checked || s.last_checked,
            release_notes: versionInfo.notes ? [{ 
              version: versionInfo.version || '',
              date: versionInfo.last_checked || '',
              notes: Array.isArray(versionInfo.notes) ? versionInfo.notes : [versionInfo.notes],
              type: versionInfo.type || 'minor'
            }] : []
          };
        })
      );

      setSoftware(softwareWithVersions);
    } catch (error) {
      console.error('Error loading software:', error);
      toast.error('Failed to load software list');
    }
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const data = await getAllSoftware();
        setSoftware(data);
      } catch (error) {
        console.error('Error loading software:', error);
        toast.error('Failed to load software list');
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

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

export function useRecentUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Software[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadRecentUpdates() {
      try {
        const data = await getAllSoftware();
        
        let trackedIds = new Set<string>();
        if (user) {
          trackedIds = await getTrackedSoftware(user.id);
        }
        
        const recentUpdates = data
          .filter(s => {
            const hasUpdate = s.release_date || s.last_checked;
            const isTracked = user ? trackedIds.has(s.id) : true;
            return hasUpdate && isTracked;
          })
          .sort((a, b) => {
            // Prioritize release date, fall back to last_checked
            const dateA = a.release_date || a.last_checked;
            const dateB = b.release_date || b.last_checked;
            if (!dateA) return 1;
            if (!dateB) return -1;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
          })
          .slice(0, 15);  // Limit to 15 most recent updates

        setUpdates(recentUpdates);
      } catch (error) {
        console.error('Error loading recent updates:', error);
      } finally {
        setLoading(false);
      }
    }

    loadRecentUpdates();
  }, [user]);

  return { updates, loading };
}