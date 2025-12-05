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
    console.log('[Auth] 1. Starting auth initialization');

    let subscription: any;

    // Simple admin check function
    const checkAdmin = async (userId: string | undefined) => {
      if (!userId) {
        console.log('[Auth] 5a. No userId, setting isAdmin = false');
        setIsAdmin(false);
        return;
      }

      try {
        console.log('[Auth] 5b. Checking admin status...');
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        console.log('[Auth] 5c. Admin check complete:', !!data);
        setIsAdmin(!!data);
      } catch (err) {
        console.log('[Auth] 5d. Admin check error:', err);
        setIsAdmin(false);
      }
    };

    // Initialize auth
    const initAuth = async () => {
      try {
        console.log('[Auth] 2. Calling getSession...');
        const { data, error } = await supabase.auth.getSession();

        console.log('[Auth] 3. getSession returned', {
          hasSession: !!data.session,
          hasError: !!error
        });

        if (error) {
          console.error('[Auth] 4. getSession error:', error);
          setLoading(false);
          return;
        }

        console.log('[Auth] 5. Setting user state');
        setUser(data.session?.user ?? null);

        await checkAdmin(data.session?.user?.id);

        console.log('[Auth] 6. Setting loading = false');
        setLoading(false);
        console.log('[Auth] 7. Auth initialization complete');
      } catch (err) {
        console.error('[Auth] Exception in initAuth:', err);
        setLoading(false);
      }
    };

    // Set up listener
    console.log('[Auth] 8. Setting up onAuthStateChange');
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('[Auth] State changed:', _event);
      setUser(session?.user ?? null);

      // Check admin on auth state changes (don't await - let it run in background)
      if (session?.user?.id) {
        checkAdmin(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });
    subscription = data.subscription;

    // Start initialization
    console.log('[Auth] 9. Starting initAuth()');
    initAuth();

    return () => {
      console.log('[Auth] 10. Cleanup');
      subscription?.unsubscribe();
    };
  }, []);

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