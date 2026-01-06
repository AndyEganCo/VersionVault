import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { AuthForm } from '@/components/auth/auth-form';

export function Signup() {
  return (
    <>
      <Helmet>
        <title>Sign Up - Start Tracking Software Updates | VersionVault</title>
        <meta name="description" content="Create a free VersionVault account and start tracking 400+ software applications. Get instant email notifications when new versions are released." />
        <link rel="canonical" href="https://versionvault.dev/signup" />

        {/* Open Graph */}
        <meta property="og:title" content="Sign Up - Start Tracking Software Updates | VersionVault" />
        <meta property="og:description" content="Create a free account and never miss a software update again." />
        <meta property="og:url" content="https://versionvault.dev/signup" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Sign Up for VersionVault" />
        <meta name="twitter:description" content="Track 400+ software applications for free." />
      </Helmet>

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
    </>
  );
}