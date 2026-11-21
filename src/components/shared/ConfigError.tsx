import { Settings2 } from 'lucide-react';

export function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-lg text-center">
        <Settings2 className="mx-auto h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Configuration required</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          PULSE needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to be set.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Copy .env.example to .env.local, add your Supabase project values, and restart the development server.
        </p>
      </div>
    </div>
  );
}
