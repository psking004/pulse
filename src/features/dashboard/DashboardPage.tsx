import type { ReactNode } from 'react';
import { Activity, AlertCircle, BellRing, CalendarClock, CircleDollarSign, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}

function DashboardCard({ title, icon: Icon, children }: DashboardCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function PlaceholderValue({ hint }: { hint: string }) {
  return (
    <>
      <p className="text-2xl font-semibold text-muted-foreground">—</p>
      <p className="mt-1 text-sm">No data yet</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </>
  );
}

export function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Receivables, payments and cashflow at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardCard title="Receivables outstanding" icon={Wallet}>
          <PlaceholderValue hint="Appears once invoices are added." />
        </DashboardCard>

        <DashboardCard title="Overdue payments" icon={AlertCircle}>
          <PlaceholderValue hint="Appears once invoices have due dates." />
        </DashboardCard>

        <DashboardCard title="Revenue collected" icon={CircleDollarSign}>
          <PlaceholderValue hint="Appears once payments are recorded." />
        </DashboardCard>

        <DashboardCard title="Upcoming bills" icon={CalendarClock}>
          <PlaceholderValue hint="Appears once expenses are recorded." />
        </DashboardCard>

        <DashboardCard title="Cashflow — next 30 days" icon={Activity}>
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Chart will be shown here
          </div>
        </DashboardCard>

        <DashboardCard title="Actionable alerts" icon={BellRing}>
          <p className="text-sm">No alerts yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Overdue invoices and low cash will be flagged here.
          </p>
        </DashboardCard>
      </div>

      <p className="mt-6 text-sm text-muted-foreground">No financial data is connected yet.</p>
    </>
  );
}
