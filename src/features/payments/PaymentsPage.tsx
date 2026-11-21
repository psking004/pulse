import { CreditCard } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function PaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" />
      <EmptyState
        icon={CreditCard}
        title="No payments yet"
        description="Payment tracking will be available in a future release."
      />
    </>
  );
}
