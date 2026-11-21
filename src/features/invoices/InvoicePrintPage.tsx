import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { InvoicePreview } from '@/features/invoices/InvoicePreview';
import { getInvoice } from '@/services/invoices';
import { getProfile } from '@/services/profile';
import type { InvoiceDetail, Profile } from '@/types/domain';

interface PageData {
  invoice: InvoiceDetail;
  profile: Profile;
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function InvoicePrintPage() {
  const { id = '' } = useParams<{ id: string }>();

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInvoice(id), getProfile()])
      .then(([invoice, profile]) => {
        if (!cancelled) {
          setData({ invoice, profile });
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load this invoice.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backLink = (
    <Link to="/invoices" className="text-sm text-primary hover:underline">
      ← Back to invoices
    </Link>
  );

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 print:bg-white">
        {backLink}
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading invoice…
        </p>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-muted/30 p-4 print:bg-white">
        {backLink}
        <p role="alert" className="mt-4 text-sm text-destructive">
          {loadError ?? 'Invoice not found.'}
        </p>
      </div>
    );
  }

  const { invoice, profile } = data;

  return (
    <div className="min-h-screen bg-muted/30 p-4 print:bg-white">
      <div className="print:hidden flex items-center justify-between gap-3 mb-4 max-w-4xl mx-auto">
        <Link to={`/invoices/${invoice.id}`} className="text-sm text-primary hover:underline">
          ← Back to invoice
        </Link>
        <Button onClick={() => window.print()}>Print</Button>
      </div>

      <div className="mx-auto max-w-4xl bg-white p-6 sm:p-10 print:max-w-none print:p-0">
        <InvoicePreview invoice={invoice} profile={profile} />
      </div>
    </div>
  );
}
