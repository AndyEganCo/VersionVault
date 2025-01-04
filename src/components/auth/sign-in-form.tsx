import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent, isSignUp: boolean) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password);
        toast.success('Account created! Please check your email to confirm your account.');
      } else {
        await signIn(email, password);
        toast.success('Signed in successfully');
      }
    } catch (error: any) {
      toast.error(error.message || (isSignUp ? 'Failed to create account' : 'Failed to sign in'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={(e) => handleSubmit(e, false)}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <div className="flex space-x-2">
        <Button 
          type="submit" 
          className="flex-1"
          disabled={loading}
        >
          Sign In
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          disabled={loading}
          onClick={(e) => handleSubmit(e, true)}
        >
          Sign Up
        </Button>
      </div>
    </form>
  );
}