import { useState, useEffect } from 'react';
import { getReleaseNotes } from '@/lib/software/release-notes/api';
import type { ReleaseNote } from '@/lib/software/release-notes/types';

export function useReleaseNotes(softwareId: string) {
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReleaseNotes() {
      try {
        const notes = await getReleaseNotes(softwareId);
        setReleaseNotes(notes);
      } catch (error) {
        console.error('Error loading release notes:', error);
      } finally {
        setLoading(false);
      }
    }

    loadReleaseNotes();
  }, [softwareId]);

  return { releaseNotes, loading };
}