import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function InvoicesPage() {
  return (
    <>
      <PageHeader title="Invoices" />
      <EmptyState
        icon={FileText}
        title="No invoices yet"
        description="Invoice management will be available in a future release."
      />
    </>
  );
}
