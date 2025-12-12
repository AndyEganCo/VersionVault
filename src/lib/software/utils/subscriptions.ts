import { supabase } from '@/lib/supabase';
import type { Software } from '../types';
import { toast } from 'sonner';

type SubscriptionCallback = (software: Software) => void;

export function subscribeSoftwareUpdates(callback: SubscriptionCallback) {
  const subscription = supabase
    .channel('software_updates')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'software'
      },
      (payload) => {
        const software = payload.new as Software;
        
        if (payload.eventType === 'UPDATE' && software.current_version !== payload.old.current_version) {
          toast.info(`New version available: ${software.name} ${software.current_version}`);
        }
        
        callback(software);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}