import { getServiceSupabase } from '../../lib/supabase';
import { isBot } from '../../lib/botFilter';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) return res.status(200).json({ ok: true, filtered: true });

  try {
    const {
      session_id,
      visitor_id,
      event_name,
      event_category,
      event_label,
      event_value,
      page_url,
      metadata,
      site_id = 'default',
    } = req.body;

    if (!session_id || !visitor_id || !event_name) {
      return res.status(400).json({ error: 'session_id, visitor_id, event_name are required' });
    }

    const db = getServiceSupabase();

    const { error } = await db.from('events').insert({
      session_id,
      visitor_id,
      event_name,
      event_category: event_category || null,
      event_label: event_label || null,
      event_value: event_value ?? null,
      page_url: page_url || null,
      metadata: metadata || null,
      site_id,
    });

    if (error) {
      console.error('Event insert error:', error);
      return res.status(500).json({ error: 'Failed to record event' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Event error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
