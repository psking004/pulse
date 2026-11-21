import { useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { useAuth } from '@/features/auth/AuthProvider';

const inputClass =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const GENERIC_SIGNUP_ERROR = 'Could not create your account. Please try again.';

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const passwordHintId = useId();
  const confirmId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fullName = String(formData.get('fullName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setPending(true);
    try {
      const result = await signUp(email, password, fullName);
      if (result.needsEmailConfirmation) {
        setConfirmationSent(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : GENERIC_SIGNUP_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout title="Create your account" description="Start managing invoices and cashflow with PULSE.">
      {confirmationSent ? (
        <div className="flex flex-col gap-4">
          <p role="status" className="text-sm">
            Check your email to confirm your account, then sign in.
          </p>
          <Link to="/login" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            Go to sign in
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              Full name
            </label>
            <input id={nameId} name="fullName" type="text" autoComplete="name" required className={inputClass} />
          </div>
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
              autoComplete="new-password"
              minLength={8}
              required
              aria-describedby={passwordHintId}
              className={inputClass}
            />
            <p id={passwordHintId} className="text-xs text-muted-foreground">
              At least 8 characters.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={confirmId} className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id={confirmId}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
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
            Create account
          </Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Already have an account? Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

