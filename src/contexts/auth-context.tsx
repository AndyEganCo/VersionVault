import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  isPremium: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let subscription: any;

    // Check if user is admin
    const checkAdmin = async (userId: string | undefined) => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        setIsAdmin(!!data);
      } catch (err) {
        console.error('[Auth] Admin check failed:', err);
        setIsAdmin(false);
      }
    };

    // Check if user is premium
    const checkPremium = async (userId: string | undefined) => {
      if (!userId) {
        setIsPremium(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('premium_users')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        setIsPremium(!!data);
      } catch (err) {
        console.error('[Auth] Premium check failed:', err);
        setIsPremium(false);
      }
    };

    // Initialize auth session
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[Auth] Failed to get session:', error);
          setLoading(false);
          return;
        }

        setUser(data.session?.user ?? null);
        await checkAdmin(data.session?.user?.id);
        await checkPremium(data.session?.user?.id);
        setLoading(false);
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        setLoading(false);
      }
    };

    // Listen for auth state changes
    // IMPORTANT: Don't await checkAdmin/checkPremium here - it would block the auth state change
    // and prevent getSession from completing, causing the app to freeze on refresh
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user?.id) {
        checkAdmin(session.user.id); // Fire and forget
        checkPremium(session.user.id); // Fire and forget
      } else {
        setIsAdmin(false);
        setIsPremium(false);
      }
    });
    subscription = data.subscription;

    // Start initialization
    initAuth();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      isPremium,
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
        const { error } = await supabase.auth.signOut({ scope: 'local' });
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