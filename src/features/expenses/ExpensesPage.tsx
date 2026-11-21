import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';

export function ExpensesPage() {
  return (
    <>
      <PageHeader title="Expenses" />
      <EmptyState
        icon={Receipt}
        title="No expenses yet"
        description="Expense tracking will be available in a future release."
      />
    </>
  );
}
