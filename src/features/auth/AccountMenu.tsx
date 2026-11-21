import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/AuthProvider';

export function AccountMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setError(null);
    setPending(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setError('Could not sign out. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:block">{user?.email}</span>
      <Button variant="outline" size="sm" onClick={handleSignOut} disabled={pending}>
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

