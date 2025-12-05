import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { CheckCircle, XCircle, Mail, ArrowLeft } from 'lucide-react';

type UnsubscribeStatus = 'loading' | 'success' | 'error' | 'already_unsubscribed';

export function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<UnsubscribeStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);

  const userId = searchParams.get('uid');

  useEffect(() => {
    if (userId) {
      handleUnsubscribe();
    } else {
      setStatus('error');
    }
  }, [userId]);

  const handleUnsubscribe = async () => {
    if (!userId) {
      setStatus('error');
      return;
    }

    try {
      // Get user email for display
      const { data: userData } = await supabase
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userData) {
        setEmail(userData.email);
      }

      // Check current settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('email_notifications')
        .eq('user_id', userId)
        .single();

      if (settings && !settings.email_notifications) {
        setStatus('already_unsubscribed');
        return;
      }

      // Disable email notifications
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          email_notifications: false,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      setStatus('success');
    } catch (error) {
      console.error('Unsubscribe error:', error);
      setStatus('error');
    }
  };

  const handleResubscribe = async () => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          email_notifications: true,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        throw error;
      }

      setStatus('loading');
      // Brief delay before showing success
      setTimeout(() => {
        window.location.href = '/user/notifications';
      }, 500);
    } catch (error) {
      console.error('Resubscribe error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === 'success' || status === 'already_unsubscribed' ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : status === 'error' ? (
              <XCircle className="h-12 w-12 text-red-500" />
            ) : (
              <Mail className="h-12 w-12 text-muted-foreground animate-pulse" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' && 'Processing...'}
            {status === 'success' && 'Unsubscribed'}
            {status === 'already_unsubscribed' && 'Already Unsubscribed'}
            {status === 'error' && 'Oops!'}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'Please wait while we process your request.'}
            {status === 'success' && (
              <>
                {email ? (
                  <>You've been unsubscribed from VersionVault emails at <strong>{email}</strong>.</>
                ) : (
                  <>You've been unsubscribed from VersionVault emails.</>
                )}
              </>
            )}
            {status === 'already_unsubscribed' && (
              <>
                {email ? (
                  <><strong>{email}</strong> is already unsubscribed from VersionVault emails.</>
                ) : (
                  <>This email is already unsubscribed from VersionVault emails.</>
                )}
              </>
            )}
            {status === 'error' && 'Something went wrong. Please try again or contact support.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === 'success' || status === 'already_unsubscribed') && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                You won't receive any more email digests from us. You can re-enable notifications anytime from your settings.
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" onClick={handleResubscribe}>
                  <Mail className="h-4 w-4 mr-2" />
                  Re-subscribe
                </Button>
                <Button variant="ghost" asChild>
                  <Link to="/">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to VersionVault
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Try Again
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to VersionVault
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branding footer */}
      <div className="fixed bottom-4 text-center text-sm text-muted-foreground">
        <span className="font-mono">&gt;_</span> VersionVault
      </div>
    </div>
  );
}
