import { Link } from 'react-router-dom';
import { AuthForm } from '@/components/auth/auth-form';

export function Signup() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="mx-auto w-[350px] space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create an Account
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your details to create your account
          </p>
        </div>
        <AuthForm mode="signup" />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link 
            to="/login" 
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}