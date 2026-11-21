import type { ReactNode } from 'react';
import { Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-lg font-semibold tracking-tight">PULSE</p>
            <p className="text-sm text-muted-foreground">Your business. Your cashflow. Your next move.</p>
          </div>
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}

