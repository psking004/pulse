import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { ConfigError } from '@/components/shared/ConfigError';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { isSupabaseConfigured } from '@/services/supabase';

export function App() {
  return (
    <ErrorBoundary>
      {isSupabaseConfigured ? (
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      ) : (
        <ConfigError />
      )}
    </ErrorBoundary>
  );
}
