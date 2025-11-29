import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserWithAdmin {
  readonly id: string;
  readonly email: string;
  readonly created_at: string;
  readonly isAdmin: boolean;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Get all users from auth.users
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();

      if (authError) throw authError;

      // Get all admin users
      const { data: adminUsers, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id');

      if (adminError) throw adminError;

      const adminUserIds = new Set(adminUsers?.map(a => a.user_id) || []);

      const usersWithAdmin = authUsers.map(user => ({
        id: user.id,
        email: user.email || '',
        created_at: user.created_at,
        isAdmin: adminUserIds.has(user.id),
      }));

      setUsers(usersWithAdmin);
    } catch (error) {
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    try {
      if (isAdmin) {
        // Add to admin_users
        const { error } = await supabase
          .from('admin_users')
          .insert([{ user_id: userId }]);

        if (error) throw error;
      } else {
        // Remove from admin_users
        const { error } = await supabase
          .from('admin_users')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      }

      await fetchUsers();
      return true;
    } catch (error) {
      console.error('Error toggling admin status:', error);
      return false;
    }
  };

  return {
    users,
    loading,
    refreshUsers: fetchUsers,
    toggleAdmin,
  };
}
