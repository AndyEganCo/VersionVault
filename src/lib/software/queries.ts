import { supabase } from '@/lib/supabase';
import type { Software } from './types';

export async function getAllSoftware(): Promise<Software[]> {
  const { data, error } = await supabase
    .from('software')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching software:', error);
    throw new Error('Failed to fetch software');
  }

  return data;
}

export async function getCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('software')
    .select('category')
    .order('category');

  if (error) {
    console.error('Error fetching categories:', error);
    throw new Error('Failed to fetch categories');
  }

  // Get unique categories
  const categories = [...new Set(data.map(s => s.category))];
  return categories;
}