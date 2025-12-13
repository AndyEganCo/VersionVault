import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly created_at: string;
  readonly isAdmin: boolean;
  readonly isPremium: boolean;
}

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      // Get all users from the public.users table
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, email, created_at')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      // Get all admin user IDs
      const { data: adminData, error: adminError } = await supabase
        .from('admin_users')
        .select('user_id');

      if (adminError) throw adminError;

      // Get all premium user IDs
      const { data: premiumData, error: premiumError } = await supabase
        .from('premium_users')
        .select('user_id');

      if (premiumError) throw premiumError;

      // Create Sets for fast lookup
      const adminIds = new Set(adminData?.map(a => a.user_id) || []);
      const premiumIds = new Set(premiumData?.map(p => p.user_id) || []);

      // Combine the data
      const usersWithStatus = (usersData || []).map(user => ({
        ...user,
        isAdmin: adminIds.has(user.id),
        isPremium: premiumIds.has(user.id)
      }));

      setUsers(usersWithStatus);
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

  const togglePremium = async (userId: string, isPremium: boolean) => {
    try {
      if (isPremium) {
        // Add to premium_users
        const { error } = await supabase
          .from('premium_users')
          .insert([{ user_id: userId }]);

        // Ignore duplicate key errors (user already premium)
        if (error && error.code !== '23505') throw error;
      } else {
        // Remove from premium_users
        const { error } = await supabase
          .from('premium_users')
          .delete()
          .eq('user_id', userId);

        if (error) throw error;
      }

      // Update local state optimistically without refetching
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId ? { ...u, isPremium } : u
        )
      );

      return true;
    } catch (error) {
      console.error('Error toggling premium status:', error);
      return false;
    }
  };

  return {
    users,
    loading,
    refreshUsers: fetchUsers,
    toggleAdmin,
    togglePremium,
  };
}
