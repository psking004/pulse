import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CustomerForm } from '@/features/customers/CustomerForm';
import { INDIAN_STATES } from '@/lib/indianStates';
import { deleteCustomer, listCustomers } from '@/services/customers';
import type { Customer } from '@/types/domain';

const STATE_NAMES = new Map<string, string>(INDIAN_STATES.map((state) => [state.code, state.name] as const));

function stateName(code: string | null): string {
  if (!code) return '—';
  return STATE_NAMES.get(code) ?? '—';
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface RowActionsProps {
  customer: Customer;
  busy: boolean;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
}

function RowActions({ customer, busy, onEdit, onDelete }: RowActionsProps) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        aria-label={`Edit ${customer.name}`}
        onClick={() => onEdit(customer)}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={busy}
        aria-label={`Delete ${customer.name}`}
        onClick={() => onDelete(customer)}
      >
        Delete
      </Button>
    </div>
  );
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCustomers()
      .then((rows) => {
        if (!cancelled) {
          setCustomers(rows);
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load customers.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadError(null);
    try {
      setCustomers(await listCustomers());
    } catch (err) {
      setLoadError(messageOf(err, 'Could not load customers.'));
    } finally {
      setLoading(false);
    }
  }, []);

  function clearFeedback(): void {
    setStatus(null);
    setActionError(null);
  }

  function startEdit(target: Customer | 'new'): void {
    clearFeedback();
    setEditing(target);
  }

  function handleSaved(): void {
    setEditing(null);
    setActionError(null);
    setStatus('Customer saved.');
    void reload();
  }

  async function handleDelete(customer: Customer): Promise<void> {
    if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    clearFeedback();
    setDeletingId(customer.id);
    try {
      await deleteCustomer(customer.id);
      setEditing((current) =>
        current !== null && current !== 'new' && current.id === customer.id ? null : current,
      );
      setStatus('Customer deleted.');
      await reload();
    } catch (err) {
      setActionError(messageOf(err, 'Could not delete the customer.'));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Clients you invoice. Each customer keeps its own GSTIN and state for tax calculations."
        actions={
          <Button onClick={() => startEdit('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add customer
          </Button>
        }
      />

      {status ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {editing !== null ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing === 'new' ? 'New customer' : 'Edit customer'}</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? null : editing}
              onSaved={handleSaved}
              onCancel={() => setEditing(null)}
            />
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading customers…
        </p>
      ) : loadError ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <Button variant="outline" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : customers && customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add a customer to start creating invoices for them."
        >
          <Button onClick={() => startEdit('new')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add customer
          </Button>
        </EmptyState>
      ) : customers ? (
        <>
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Name</th>
                  <th scope="col" className="px-4 py-3 font-medium">GSTIN</th>
                  <th scope="col" className="px-4 py-3 font-medium">State</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Phone</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{customer.gstin ?? '—'}</td>
                    <td className="px-4 py-3">{stateName(customer.state_code)}</td>
                    <td className="px-4 py-3">{customer.email ?? '—'}</td>
                    <td className="px-4 py-3">{customer.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <RowActions
                        customer={customer}
                        busy={deletingId === customer.id}
                        onEdit={(c) => startEdit(c)}
                        onDelete={(c) => void handleDelete(c)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {customers.map((customer) => (
              <li key={customer.id} className="space-y-2 rounded-xl border bg-card p-4">
                <Link to={`/customers/${customer.id}`} className="font-medium text-primary hover:underline">
                  {customer.name}
                </Link>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">GSTIN</dt>
                  <dd>{customer.gstin ?? '—'}</dd>
                  <dt className="text-muted-foreground">State</dt>
                  <dd>{stateName(customer.state_code)}</dd>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{customer.email ?? '—'}</dd>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{customer.phone ?? '—'}</dd>
                </dl>
                <div className="flex justify-end pt-1">
                  <RowActions
                    customer={customer}
                    busy={deletingId === customer.id}
                    onEdit={(c) => startEdit(c)}
                    onDelete={(c) => void handleDelete(c)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
