import { useAuth } from '@/contexts/auth-context';
import { EmailForm } from '@/components/profile/email-form';
import { ProfileForm } from '@/components/profile/profile-form';
import { PasswordForm } from '@/components/profile/password-form';

export function UserProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile Settings</h3>
        <p className="text-sm text-muted-foreground">
          Manage your account information and security settings
        </p>
      </div>
      <ProfileForm />
      <EmailForm currentEmail={user.email || ''} />
      <PasswordForm />
    </div>
  );
}