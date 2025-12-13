import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Loader2 } from 'lucide-react';

export function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Wait a moment for Supabase to process the URL tokens
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if we have a session
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          setStatus('error');
          // Redirect to login with error
          setTimeout(() => {
            navigate('/login', {
              state: { message: 'Verification failed. Please try again.' }
            });
          }, 2000);
          return;
        }

        if (data.session) {
          // Successfully verified and logged in
          setStatus('success');

          // Mark as new user for welcome box
          localStorage.setItem('versionvault-new-user', 'true');

          // Redirect to dashboard
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 1500);
        } else {
          // Email verified but no session (shouldn't happen, but handle it)
          setStatus('success');
          setTimeout(() => {
            navigate('/login', {
              state: {
                verified: true,
                message: 'Email verified! Please log in below.'
              }
            });
          }, 1500);
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setStatus('error');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-[500px] items-center justify-center">
      <div className="mx-auto w-full max-w-md space-y-6 px-4 text-center">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Verifying Your Email
            </h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your account...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Email Verified!
            </h1>
            <p className="text-sm text-muted-foreground">
              Redirecting you to your dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <CheckCircle2 className="h-12 w-12 text-red-500" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Verification Failed
            </h1>
            <p className="text-sm text-muted-foreground">
              Redirecting you to login...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
