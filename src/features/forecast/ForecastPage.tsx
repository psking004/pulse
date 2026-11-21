import { TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function ForecastPage() {
  return (
    <>
      <PageHeader title="Forecast" />
      <EmptyState
        icon={TrendingUp}
        title="No forecast yet"
        description="Cashflow forecasting will appear here once financial data is connected."
      />
    </>
  );
}
