import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, MailCheck, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    // Get email from navigation state or check if user is already logged in
    const getEmail = async () => {
      const stateEmail = location.state?.email;
      if (stateEmail) {
        setEmail(stateEmail);
        return;
      }

      // Check if user has a session (already verified and logged in)
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        // User is already logged in, redirect to dashboard
        navigate('/dashboard', { replace: true });
      }
    };

    getEmail();
  }, [location.state, navigate]);

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Email address not found');
      return;
    }

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      toast.success('Verification email sent! Check your inbox.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-[500px] items-center justify-center">
      <div className="mx-auto w-full max-w-md space-y-6 px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
            <Mail className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Check Your Email
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We've sent a verification link to verify your account
          </p>
        </div>

        {email && (
          <Alert className="border-blue-500/50 bg-blue-500/10">
            <MailCheck className="h-4 w-4 text-blue-500" />
            <AlertDescription className="text-sm">
              <span className="font-semibold">{email}</span>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">What's next?</p>
          <ol className="ml-4 list-decimal space-y-2">
            <li>Check your inbox for an email from VersionVault</li>
            <li>Click the verification link in the email</li>
            <li>You'll be redirected back here to log in</li>
          </ol>
          <p className="text-xs">
            Don't see the email? Check your spam folder or request a new one below.
          </p>
        </div>

        <Button
          onClick={handleResendEmail}
          disabled={resending || !email}
          variant="outline"
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Sending...' : 'Resend Verification Email'}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Already verified?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary underline-offset-4 hover:underline"
          >
            Go to login
          </button>
        </p>
      </div>
    </div>
  );
}
