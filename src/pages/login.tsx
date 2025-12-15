import { Link } from 'react-router-dom';
import { AuthForm } from '@/components/auth/auth-form';

export function Login() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="mx-auto w-[350px] space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your account to continue
          </p>
        </div>
        <AuthForm mode="signin" />
        <div className="space-y-4">
          <p className="text-center text-sm">
            <Link
              to="/forgot-password"
              className="text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-primary underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}