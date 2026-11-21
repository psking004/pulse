import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';

const inputClass =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function getRedirectPath(state: unknown): string {
  if (typeof state === 'object' && state !== null && 'from' in state) {
    const from = state.from;
    if (typeof from === 'string' && from.startsWith('/')) {
      return from;
    }
  }
  return '/';
}

function getSignInErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Invalid login credentials')) {
    return 'Email or password is incorrect.';
  }
  return 'Could not sign in. Please try again.';
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emailId = useId();
  const passwordId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    setError(null);
    setPending(true);
    try {
      await signIn(email, password);
      navigate(getRedirectPath(location.state), { replace: true });
    } catch (err) {
      setError(getSignInErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Sign in" description="Use your email and password.">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-sm font-medium">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={passwordId} className="text-sm font-medium">
            Password
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className={inputClass}
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

