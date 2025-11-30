import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface AdminUser {
  readonly user_id: string;
  readonly created_at?: string;
}

export function useAdminUsers() {
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdminUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Get all admin users - only user_id is guaranteed to exist
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('*');

      if (adminError) throw adminError;

      setAdminUsers(adminData || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      setAdminUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminUsers();
  }, [fetchAdminUsers]);

  const addAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .insert([{
          user_id: userId
        }]);

      if (error) throw error;

      await fetchAdminUsers();
      return true;
    } catch (error) {
      console.error('Error adding admin:', error);
      return false;
    }
  };

  const removeAdmin = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;

      await fetchAdminUsers();
      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      return false;
    }
  };

  return {
    adminUsers,
    loading,
    refreshAdminUsers: fetchAdminUsers,
    addAdmin,
    removeAdmin,
  };
}
