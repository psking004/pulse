// Text generation only. Performs no database writes and no payment actions.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TONES = ['polite', 'professional', 'firm'] as const;
type Tone = (typeof TONES)[number];

const TONE_GUIDANCE: Record<Tone, string> = {
  polite: 'warm and gentle',
  professional: 'neutral and businesslike',
  firm: 'direct, asks for payment by a clear date, still respectful',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function daysBetweenUtc(dueDate: string): number {
  const [y, m, d] = String(dueDate).split('-').map(Number);
  const due = Date.UTC(y, m - 1, d);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Math.floor((today - due) / 86400000);
  return Number.isFinite(days) ? Math.max(0, days) : 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!apiKey || !supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Reminder service is not configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Sign in to generate reminders.' }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: { invoice_id?: unknown; tone?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request body.' }, 400);
  }

  const invoiceId = typeof body?.invoice_id === 'string' ? body.invoice_id.trim() : '';
  if (!invoiceId) {
    return jsonResponse({ error: 'invoice_id is required.' }, 400);
  }
  if (typeof body.tone !== 'string' || !(TONES as readonly string[]).includes(body.tone)) {
    return jsonResponse({ error: 'tone must be polite, professional or firm.' }, 400);
  }
  const tone = body.tone as Tone;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    return jsonResponse({ error: 'Sign in to generate reminders.' }, 401);
  }

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('invoice_number, due_date, total_amount, balance_due, status, customer:customers(name)')
    .eq('id', invoiceId)
    .single();

  if (invoiceError || !invoice) {
    return jsonResponse({ error: 'Invoice not found.' }, 404);
  }

  const balanceDue = Number(invoice.balance_due);
  if (invoice.status !== 'sent' || !(balanceDue > 0)) {
    return jsonResponse({ error: 'Reminders are only for unpaid sent invoices.' }, 409);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, contact_name, currency')
    .eq('id', userData.user.id)
    .single();

  const customerRow = Array.isArray(invoice.customer) ? invoice.customer[0] : invoice.customer;
  const customerName: string = customerRow?.name ?? '';
  const businessName: string = profile?.business_name ?? '';
  const contactName: string = profile?.contact_name ?? '';
  const currency: string = profile?.currency ?? '';
  const balanceText = `${balanceDue.toFixed(2)} ${currency}`.trim();
  const daysOverdue = daysBetweenUtc(invoice.due_date);

  const prompt = [
    'Write a short payment reminder email for an unpaid invoice.',
    `Tone: ${TONE_GUIDANCE[tone]}.`,
    'Use ONLY the facts listed below. Do not invent dates, bank details, penalties or legal claims.',
    'Mention only the balance given. Keep the email under 150 words.',
    'Return ONLY JSON of the shape {"subject": string, "body": string}.',
    '',
    'Facts:',
    `- Customer name: ${customerName}`,
    `- Business name: ${businessName}`,
    `- Contact name: ${contactName}`,
    `- Invoice number: ${invoice.invoice_number}`,
    `- Balance due: ${balanceText}`,
    `- Due date: ${invoice.due_date}`,
    `- Days overdue: ${daysOverdue}`,
  ].join('\n');

  let response: Response;
  try {
    response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
        }),
      },
    );
  } catch {
    return jsonResponse({ error: 'Reminder service is unreachable. Try again.' }, 502);
  }

  if (response.status === 429) {
    return jsonResponse({ error: 'Too many reminder requests. Wait a minute and try again.' }, 429);
  }
  if (!response.ok) {
    return jsonResponse({ error: 'The reminder could not be generated. Try again.' }, 502);
  }

  const invalidOutput = () =>
    jsonResponse({ error: 'The reminder could not be generated. Try again.' }, 502);

  let text: unknown;
  try {
    const payload = await response.json();
    text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return invalidOutput();
  }
  if (typeof text !== 'string') {
    return invalidOutput();
  }

  let parsed: { subject?: unknown; body?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return invalidOutput();
  }

  if (
    !parsed ||
    typeof parsed.subject !== 'string' ||
    typeof parsed.body !== 'string'
  ) {
    return invalidOutput();
  }

  const subject = parsed.subject.trim().slice(0, 150);
  const emailBody = parsed.body.trim().slice(0, 2000);
  if (!subject || !emailBody) {
    return invalidOutput();
  }

  return jsonResponse({ subject, body: emailBody }, 200);
});
