import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Software } from '../types';

export async function updateSoftwareVersion(
  id: string, 
  version: string
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('update_software_version', {
      software_id: id,
      new_version: version
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating software version:', error);
    toast.error('Failed to update version');
    return false;
  }
}

export async function updateSoftware(
  id: string, 
  data: Partial<Software>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .update(data)
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating software:', error);
    toast.error('Failed to update software');
    return false;
  }
}