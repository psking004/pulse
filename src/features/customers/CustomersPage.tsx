import { Users } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Customer records will be available in a future release."
      />
    </>
  );
}
