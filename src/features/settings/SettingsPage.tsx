import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Account and business preferences." />
      <Card>
        <CardHeader>
          <CardTitle>Business profile</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Business details will be configured here.</p>
        </CardContent>
      </Card>
    </>
  );
}
