import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { VersionCheck, VersionCheckStats } from '@/types/version-check';

type Filters = {
  status: 'all' | 'success' | 'error';
  timeRange: '24h' | '7d' | '30d' | 'all';
};

export function useVersionChecks(filters: Filters) {
  const [checks, setChecks] = useState<VersionCheck[]>([]);
  const [stats, setStats] = useState<VersionCheckStats>({
    total: 0,
    successful: 0,
    failed: 0,
    newVersions: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChecks() {
      try {
        // Get time range
        const now = new Date();
        let startDate = new Date();

        switch (filters.timeRange) {
          case '24h':
            startDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
          case 'all':
            startDate = new Date(0); // Beginning of time
            break;
        }

        // Fetch checks
        let query = supabase
          .from('version_checks')
          .select('*')
          .order('checked_at', { ascending: false })
          .gte('checked_at', startDate.toISOString());

        if (filters.status !== 'all') {
          query = query.eq('status', filters.status);
        }

        const { data: checks, error: checksError } = await query;
        if (checksError) throw checksError;

        // Get stats
        const { data: statsData, error: statsError } = await supabase
          .from('version_check_stats')
          .select('*')
          .single();
        
        if (statsError) throw statsError;

        setChecks(checks || []);
        setStats({
          total: statsData.total_checks,
          successful: statsData.successful_checks,
          failed: statsData.failed_checks,
          newVersions: statsData.new_versions
        });
      } catch (error) {
        console.error('Error fetching version checks:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchChecks();
  }, [filters]);

  return { checks, stats, loading };
}