import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[Auth] Initializing auth context...');

    // Check active session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[Auth] Session retrieved:', session ? 'User logged in' : 'No session');
      setUser(session?.user ?? null);
      await checkAdminStatus(session?.user?.id);
      console.log('[Auth] Auth initialization complete, setting loading to false');
      setLoading(false);
    }).catch((error) => {
      console.error('[Auth] Auth init error:', error);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[Auth] Auth state changed:', _event, session ? 'User logged in' : 'No session');
      setUser(session?.user ?? null);
      await checkAdminStatus(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkAdminStatus(userId: string | undefined) {
    if (!userId) {
      console.log('[Auth] No user ID, setting isAdmin to false');
      setIsAdmin(false);
      return;
    }

    console.log('[Auth] Checking admin status for user:', userId);
    const { data, error } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('[Auth] Admin check error (user might not be admin):', error.message);
    }

    console.log('[Auth] Admin status:', !!data);
    setIsAdmin(!!data);
  }

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      },
      signUp: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        navigate('/login');
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}