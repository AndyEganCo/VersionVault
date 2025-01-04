import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';

type AuthFormProps = {
  mode: 'signin' | 'signup';
};

export function AuthForm({ mode }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'signup') {
        await signUp(email, password);
        toast.success('Account created successfully');
      } else {
        await signIn(email, password);
        toast.success('Signed in successfully');
      }
    } catch (error: any) {
      toast.error(error.message || `Failed to ${mode === 'signup' ? 'create account' : 'sign in'}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="m@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
          minLength={6}
        />
      </div>
      <Button 
        type="submit" 
        className="w-full"
        disabled={loading}
      >
        {mode === 'signup' ? 'Create Account' : 'Sign In'}
      </Button>
    </form>
  );
}