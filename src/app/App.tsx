import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { ConfigError } from '@/components/shared/ConfigError';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { isSupabaseConfigured } from '@/services/supabase';

export function App() {
  return (
    <ErrorBoundary>
      {isSupabaseConfigured ? <RouterProvider router={router} /> : <ConfigError />}
    </ErrorBoundary>
  );
}
