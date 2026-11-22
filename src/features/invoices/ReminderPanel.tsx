import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { generateReminder, type ReminderTone } from '@/services/reminders';

export interface ReminderPanelProps {
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  currency: string;
}

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const TEXTAREA_CLASS =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const TONE_OPTIONS: { value: ReminderTone; label: string }[] = [
  { value: 'polite', label: 'Polite' },
  { value: 'professional', label: 'Professional' },
  { value: 'firm', label: 'Firm' },
];

const FALLBACK_ERROR = 'Could not generate the reminder. Try again.';

/** Drafts a payment reminder for one invoice. Shows a draft only; nothing is sent or saved. */
export function ReminderPanel({ invoiceId, invoiceNumber, customerName, currency }: ReminderPanelProps) {
  const [tone, setTone] = useState<ReminderTone>('polite');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [hasDraft, setHasDraft] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  async function generate(): Promise<void> {
    setGenerating(true);
    setError(null);
    setCopyStatus(null);
    try {
      const result = await generateReminder(invoiceId, tone);
      // Replace the editable text only after a successful response.
      setSubject(result.subject);
      setMessage(result.body);
      setHasDraft(true);
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : FALLBACK_ERROR);
    } finally {
      setGenerating(false);
    }
  }

  async function copyDraft(): Promise<void> {
    setCopyStatus(null);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(`${subject}\n\n${message}`);
      setCopyStatus('Copied.');
    } catch {
      setCopyStatus('Copy failed. Select the text and copy it manually.');
    }
  }

  function clearDraft(): void {
    setSubject('');
    setMessage('');
    setHasDraft(false);
    setError(null);
    setCopyStatus(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment reminder</CardTitle>
        <p className="text-sm text-muted-foreground">Drafts a message only. Nothing is sent, and no record changes.</p>
        <p className="text-sm text-muted-foreground">
          {`Invoice ${invoiceNumber} for ${customerName}. Amounts are in ${currency}.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="reminder-tone" className="text-sm font-medium">
              Tone
            </label>
            <select
              id="reminder-tone"
              className={INPUT_CLASS}
              value={tone}
              disabled={generating}
              onChange={(e) => setTone(e.target.value as ReminderTone)}
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {hasDraft ? (
            <Button type="button" variant="outline" onClick={generate} disabled={generating}>
              {generating ? 'Generating…' : 'Regenerate'}
            </Button>
          ) : (
            <Button type="button" onClick={generate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate reminder'}
            </Button>
          )}
        </div>

        {generating ? (
          <p role="status" className="text-sm text-muted-foreground">
            Generating…
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {hasDraft ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reminder-subject" className="text-sm font-medium">
                Subject
              </label>
              <input
                id="reminder-subject"
                type="text"
                className={INPUT_CLASS}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reminder-message" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="reminder-message"
                rows={10}
                className={TEXTAREA_CLASS}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="outline" onClick={copyDraft}>
                Copy
              </Button>
              <Button type="button" variant="ghost" onClick={clearDraft} disabled={generating}>
                Clear
              </Button>
            </div>
            {copyStatus ? (
              <p role="status" className="text-sm text-muted-foreground">
                {copyStatus}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
