import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, invokeEdgeFunction } from '@/lib/supabase';
import { getStoredReferralCode, clearStoredReferralCode } from '@/lib/referral-tracking';
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

          // Metadata is populated only during email signup, so its presence
          // means this callback is an email verification. For OAuth signups,
          // fall back to the stored code — but only if the user was just
          // created, so existing users signing in via Google aren't credited
          // as fresh referrals.
          const metaCode = data.session.user.user_metadata?.referral_code;
          const storedCode = getStoredReferralCode();
          const ageMs = Date.now() - new Date(data.session.user.created_at).getTime();
          const ageMin = Math.round(ageMs / 60000);
          const isRecentSignup = ageMs < 10 * 60 * 1000;
          const referralCode = metaCode || (isRecentSignup ? storedCode : null);
          console.log(
            `[Referral] auth-callback — userId=${data.session.user.id} ` +
            `metaCode=${metaCode ?? '(none)'} storedCode=${storedCode ?? '(none)'} ` +
            `userAge=${ageMin}min isRecentSignup=${isRecentSignup} resolved=${referralCode ?? '(none)'}`
          );
          if (referralCode) {
            try {
              console.log(`[Referral] Invoking process-referral with code=${referralCode}`);
              const result = await invokeEdgeFunction('process-referral', {
                referredUserId: data.session.user.id,
                referralCode,
                type: 'signup',
              });
              console.log('[Referral] process-referral succeeded:', result);
            } catch (err) {
              console.error('[Referral] process-referral failed:', err);
            }
          } else {
            console.log('[Referral] No code to process — skipping edge function');
          }
          clearStoredReferralCode();

          // Redirect to dashboard (onboarding modal will show based on DB flag)
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
