import { requireClient } from '@/services/client';

export type ReminderTone = 'polite' | 'professional' | 'firm';

export interface ReminderResult {
  subject: string;
  body: string;
}

/** Ask the generate-payment-reminder Edge Function for a draft reminder email. */
export async function generateReminder(invoiceId: string, tone: ReminderTone): Promise<ReminderResult> {
  const { data, error } = await requireClient().functions.invoke<ReminderResult>('generate-payment-reminder', {
    body: { invoice_id: invoiceId, tone },
  });
  if (error) {
    throw new Error('Reminder generation is not available. Check that the Edge Function is deployed.');
  }
  const result: unknown = data;
  if (typeof result !== 'object' || result === null) {
    throw new Error('Reminder generation returned an unexpected response.');
  }
  const { subject, body } = result as Record<string, unknown>;
  if (typeof subject !== 'string' || typeof body !== 'string') {
    throw new Error('Reminder generation returned an unexpected response.');
  }
  return { subject, body };
}
