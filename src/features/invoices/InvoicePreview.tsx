import type { ReactNode } from 'react';
import { formatDate } from '@/lib/dates';
import { INDIAN_STATES } from '@/lib/indianStates';
import { formatMoney } from '@/lib/money';
import type { InvoiceDetail, Profile } from '@/types/domain';

interface InvoicePreviewProps {
  invoice: InvoiceDetail;
  profile: Profile;
}

const NUMERIC_CELL = 'px-2 py-2 text-right tabular-nums';
const HEAD_CELL = 'px-2 py-2 font-medium';
const HEAD_NUMERIC_CELL = 'px-2 py-2 text-right font-medium';

/** Display name for a state code, falling back to the raw code when it is not in the list. */
function stateName(code: string | null): string | null {
  if (!code) return null;
  return INDIAN_STATES.find((state) => state.code === code)?.name ?? code;
}

interface TotalLineProps {
  label: string;
  value: string;
  strong?: boolean;
  topBorder?: boolean;
}

function TotalLine({ label, value, strong = false, topBorder = false }: TotalLineProps) {
  const classes = [
    'flex items-center justify-between gap-6 py-1',
    strong ? 'font-bold' : '',
    topBorder ? 'mt-1 border-t border-slate-900 pt-2' : '',
  ].join(' ');
  return (
    <div className={classes}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

interface MetaRowProps {
  label: string;
  children: ReactNode;
}

function MetaRow({ label, children }: MetaRowProps) {
  return (
    <>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-medium tabular-nums">{children}</dd>
    </>
  );
}

export function InvoicePreview({ invoice, profile }: InvoicePreviewProps) {
  const currency = profile.currency;
  const money = (value: number): string => formatMoney(value, currency);
  const isIntra = invoice.supply_type === 'intra';
  const customer = invoice.customer;
  const businessState = stateName(profile.state_code);
  const customerState = stateName(customer?.state_code ?? null);

  return (
    <article
      aria-label={`Invoice ${invoice.invoice_number}`}
      className="w-full border border-slate-300 bg-white p-6 text-slate-900 print:rounded-none sm:p-8"
    >
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1 text-sm">
          <p className="text-xl font-semibold">{profile.business_name}</p>
          {profile.address ? <p className="whitespace-pre-line text-slate-600">{profile.address}</p> : null}
          {profile.phone ? <p className="text-slate-600">{profile.phone}</p> : null}
          {profile.email ? <p className="text-slate-600">{profile.email}</p> : null}
          {profile.gstin ? <p className="tabular-nums">GSTIN: {profile.gstin}</p> : null}
          {businessState ? <p>State: {businessState}</p> : null}
        </div>

        <div className="shrink-0 space-y-3 text-sm">
          <h2 className="text-right text-lg font-semibold tracking-wide">TAX INVOICE</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <MetaRow label="Invoice No">{invoice.invoice_number}</MetaRow>
            <MetaRow label="Issue date">{formatDate(invoice.issue_date)}</MetaRow>
            <MetaRow label="Due date">{formatDate(invoice.due_date)}</MetaRow>
            <MetaRow label="Supply">{isIntra ? 'CGST + SGST (within state)' : 'IGST (inter-state)'}</MetaRow>
          </dl>
        </div>
      </header>

      <section className="mt-8 border-t border-slate-200 pt-4 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bill to</p>
        <p className="mt-1 font-semibold">{customer?.name ?? '—'}</p>
        {customer ? (
          <div className="space-y-0.5">
            {customer.billing_address ? (
              <p className="whitespace-pre-line text-slate-700">{customer.billing_address}</p>
            ) : null}
            {customer.gstin ? <p className="tabular-nums">GSTIN: {customer.gstin}</p> : null}
            {customerState ? <p>State: {customerState}</p> : null}
          </div>
        ) : null}
      </section>

      <div className="mt-8 overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[40rem] text-sm print:min-w-0">
          <thead className="border-b border-slate-900 text-left">
            <tr>
              <th scope="col" className={HEAD_CELL}>#</th>
              <th scope="col" className={HEAD_CELL}>Description</th>
              <th scope="col" className={HEAD_NUMERIC_CELL}>Qty</th>
              <th scope="col" className={HEAD_NUMERIC_CELL}>Rate</th>
              <th scope="col" className={HEAD_NUMERIC_CELL}>Disc %</th>
              <th scope="col" className={HEAD_NUMERIC_CELL}>Taxable value</th>
              {isIntra ? (
                <>
                  <th scope="col" className={HEAD_NUMERIC_CELL}>CGST</th>
                  <th scope="col" className={HEAD_NUMERIC_CELL}>SGST</th>
                </>
              ) : (
                <th scope="col" className={HEAD_NUMERIC_CELL}>IGST</th>
              )}
              <th scope="col" className={HEAD_NUMERIC_CELL}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-200 align-top">
                <td className="px-2 py-2 tabular-nums">{item.position}</td>
                <td className="px-2 py-2">
                  <span className="block">{item.description}</span>
                  {item.hsn_sac ? (
                    <span className="block text-xs text-slate-600">HSN/SAC: {item.hsn_sac}</span>
                  ) : null}
                </td>
                <td className={NUMERIC_CELL}>{item.quantity}</td>
                <td className={NUMERIC_CELL}>{money(item.unit_price)}</td>
                <td className={NUMERIC_CELL}>{item.discount_percent}</td>
                <td className={NUMERIC_CELL}>{money(item.taxable_value)}</td>
                {isIntra ? (
                  <>
                    <td className={NUMERIC_CELL}>{money(item.cgst_amount)}</td>
                    <td className={NUMERIC_CELL}>{money(item.sgst_amount)}</td>
                  </>
                ) : (
                  <td className={NUMERIC_CELL}>{money(item.igst_amount)}</td>
                )}
                <td className={NUMERIC_CELL}>{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex justify-end">
        <div className="w-full max-w-xs text-sm">
          <TotalLine label="Subtotal" value={money(invoice.subtotal)} />
          {invoice.discount_total > 0 ? (
            <TotalLine label="Discount" value={money(invoice.discount_total)} />
          ) : null}
          {isIntra ? (
            <>
              <TotalLine label="CGST" value={money(invoice.cgst_amount)} />
              <TotalLine label="SGST" value={money(invoice.sgst_amount)} />
            </>
          ) : (
            <TotalLine label="IGST" value={money(invoice.igst_amount)} />
          )}
          <TotalLine label="Total" value={money(invoice.total_amount)} strong topBorder />
          <TotalLine label="Amount paid" value={money(invoice.amount_paid)} />
          <TotalLine label="Balance due" value={money(invoice.balance_due)} strong />
        </div>
      </div>

      {invoice.notes ? (
        <section className="mt-8 border-t border-slate-200 pt-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</p>
          <p className="mt-1 whitespace-pre-line">{invoice.notes}</p>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-600">
        This is a computer-generated invoice.
      </footer>
    </article>
  );
}
