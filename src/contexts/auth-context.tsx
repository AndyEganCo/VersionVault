import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, invokeEdgeFunction } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

type AuthContextType = {
  user: User | null;
  isAdmin: boolean;
  isPremium: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteOwnAccount: () => Promise<void>;
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

  // Tear down all client-side session state and redirect to /login. Used by
  // both signOut and deleteOwnAccount so the cleanup stays in sync.
  const clearLocalSession = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      // Session may already be invalid (e.g., user was deleted server-side).
      // Continue with local cleanup regardless.
      console.warn('Local sign out failed, clearing state anyway:', error);
    }
    localStorage.clear();
    setUser(null);
    setIsAdmin(false);
    setIsPremium(false);
    navigate('/login');
  };

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        navigate('/verify-email', { state: { email } });
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // Navigation happens automatically after OAuth redirect
      },
      signOut: clearLocalSession,
      deleteOwnAccount: async () => {
        if (!user) {
          throw new Error('Not signed in');
        }
        // Throws on any non-2xx with the actual server error message.
        await invokeEdgeFunction('delete-user', { userId: user.id });
        await clearLocalSession();
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