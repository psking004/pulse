import { useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { BusinessProfileForm } from '@/features/settings/BusinessProfileForm';
import { useAuth } from '@/features/auth/AuthProvider';
import { getProfile } from '@/services/profile';
import type { Profile } from '@/types/domain';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getProfile()
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setLoadError(null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load your settings. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setLoading(true);
    setLoadError(null);
    setAttempt((n) => n + 1);
  }

  async function handleSignOut() {
    if (!window.confirm('Sign out of PULSE?')) return;
    setSignOutError(null);
    setSigningOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch {
      setSignOutError('Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <PageHeader title="Settings" description="Business profile, cash settings and your account." />

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading settings…
        </p>
      ) : null}

      {loadError ? (
        <div className="mb-6 flex items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {profile ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            <BusinessProfileForm
              key="business-profile"
              profile={profile}
              onSaved={(p) => setProfile(p)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              {user?.email ? (
                <>
                  Signed in as <span className="font-medium">{user.email}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Not signed in</span>
              )}
            </p>
            <Button variant="outline" onClick={handleSignOut} disabled={signingOut}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>

          {signOutError ? (
            <p role="alert" className="text-sm text-destructive">
              {signOutError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your records are private to your account and are protected by row-level security in the database.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
