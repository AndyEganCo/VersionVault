import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate } from './types';
import { toast } from 'sonner';

export async function getSoftwareList(): Promise<Software[]> {
  try {
    const { data, error } = await supabase
      .from('software')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching software:', error);
    toast.error('Failed to load software list');
    return [];
  }
}

export async function updateSoftware(id: string, update: SoftwareUpdate): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .update(update)
      .eq('id', id);

    if (error) throw error;
    toast.success('Software updated successfully');
    return true;
  } catch (error) {
    console.error('Error updating software:', error);
    toast.error('Failed to update software');
    return false;
  }
}

export async function createSoftware(software: Omit<Software, 'created_at' | 'updated_at'>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .insert(software);

    if (error) throw error;
    toast.success('Software added successfully');
    return true;
  } catch (error) {
    console.error('Error creating software:', error);
    toast.error('Failed to add software');
    return false;
  }
}

export async function deleteSoftware(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('software')
      .delete()
      .eq('id', id);

    if (error) throw error;
    toast.success('Software deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting software:', error);
    toast.error('Failed to delete software');
    return false;
  }
}