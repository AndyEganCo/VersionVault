import { supabase } from '@/lib/supabase';
import { Software, SoftwareUpdate } from './types';
import { toast } from 'sonner';

interface ApiResponse<T> {
  readonly data: T | null;
  readonly error: Error | null;
}

async function handleDatabaseOperation<T>(
  operation: () => Promise<{ data: T | null; error: any }>,
  successMessage: string,
  errorMessage: string
): Promise<ApiResponse<T>> {
  try {
    const { data, error } = await operation();
    if (error) throw error;
    if (successMessage) toast.success(successMessage);
    return { data, error: null };
  } catch (error) {
    console.error(`${errorMessage}:`, error);
    toast.error(errorMessage);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error(errorMessage) 
    };
  }
}

export async function getSoftwareList(): Promise<Software[]> {
  const { data } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .select('*')
      .order('name')
      .then(({ data, error }) => ({ data, error })),
    '',
    'Failed to load software list'
  );

  return data || [];
}

export async function updateSoftware(
  id: string, 
  update: SoftwareUpdate
): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .update(update)
      .eq('id', id)
      .then(({ data, error }) => ({ data, error })),
    'Software updated successfully',
    'Failed to update software'
  );

  return !error;
}

export async function createSoftware(
  software: Omit<Software, 'id' | 'created_at' | 'updated_at'>
): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .insert(software)
      .then(({ data, error }) => ({ data, error })),
    'Software added successfully',
    'Failed to add software'
  );

  return !error;
}

export async function deleteSoftware(id: string): Promise<boolean> {
  const { error } = await handleDatabaseOperation(
    () => supabase
      .from('software')
      .delete()
      .eq('id', id)
      .then(({ data, error }) => ({ data, error })),
    'Software deleted successfully',
    'Failed to delete software'
  );

  return !error;
}