/**
 * Sends a push when a coach posts something.
 *
 * Wired up as a Supabase database webhook on INSERT and UPDATE for the tables
 * below; see supabase/functions/README.md for the exact configuration.
 *
 * It deliberately does no audience reasoning of its own. push_recipients()
 * calls the same can_see_audience() the row-level policies use, so a push can
 * never reach someone who could not open the thing it is telling them about.
 */

type Audience = 'everyone' | 'clinic' | 'private' | 'coaches';

type WebhookPayload = {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
};

type Recipient = { profile_id: string; push_token: string };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo accepts at most 100 messages per request. */
const BATCH_SIZE = 100;

type Message = {
  audience: Audience;
  pref: string;
  title: string;
  body: string;
  /** Where tapping the notification should land. */
  path: string;
};

function describe(payload: WebhookPayload): Message | null {
  const row = payload.record;
  if (!row) return null;

  const audience = (row.audience as Audience) ?? 'everyone';

  switch (payload.table) {
    case 'announcements': {
      // Drafts are not news yet. An update that publishes one is, which is why
      // this fires on UPDATE as well as INSERT.
      if (!row.published_at) return null;
      if (payload.type === 'UPDATE' && payload.old_record?.published_at) return null;
      return {
        audience,
        pref: 'announcements',
        title: String(row.title ?? 'Clinic news'),
        body: String(row.body ?? '').slice(0, 160),
        path: '/',
      };
    }

    case 'practices': {
      const moved = payload.type === 'UPDATE';
      return {
        audience,
        pref: 'practices',
        title: moved ? 'Practice changed' : 'New practice posted',
        body: String(row.location_name ?? 'Check the schedule for details.'),
        path: '/schedule',
      };
    }

    case 'posts': {
      if (!row.published_at) return null;
      if (payload.type === 'UPDATE' && payload.old_record?.published_at) return null;
      return {
        audience,
        pref: 'learn',
        title: 'New from the coaches',
        body: String(row.title ?? ''),
        path: '/learn',
      };
    }

    default:
      return null;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return new Response('Not configured', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return new Response('Bad payload', { status: 400 });
  }

  const message = describe(payload);
  if (!message) {
    // Nothing to send is a success, not a failure — drafts and deletes land here.
    return Response.json({ sent: 0, reason: 'nothing to announce' });
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/push_recipients`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ p_audience: message.audience, p_pref: message.pref }),
  });

  if (!response.ok) {
    return new Response(`Could not resolve recipients: ${await response.text()}`, { status: 500 });
  }

  const recipients = (await response.json()) as Recipient[];
  if (recipients.length === 0) return Response.json({ sent: 0 });

  let sent = 0;
  const failures: string[] = [];

  for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
    const batch = recipients.slice(index, index + BATCH_SIZE).map((recipient) => ({
      to: recipient.push_token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: { path: message.path },
    }));

    const push = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(batch),
    });

    // One bad batch should not stop the rest of the clinic being told.
    if (push.ok) sent += batch.length;
    else failures.push(await push.text());
  }

  return Response.json({ sent, failures });
});
