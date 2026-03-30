import { getServiceSupabase } from '../../lib/supabase';
import { isBot } from '../../lib/botFilter';
import { parseDevice } from '../../lib/parseDevice';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30分

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ua = req.headers['user-agent'] || '';
  if (isBot(ua)) {
    return res.status(200).json({ ok: true, filtered: true });
  }

  try {
    const {
      visitor_id,
      page_url,
      page_title,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      site_id = 'default',
    } = req.body;

    if (!visitor_id || !page_url) {
      return res.status(400).json({ error: 'visitor_id and page_url are required' });
    }

    const db = getServiceSupabase();
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const { device_type, browser, os } = parseDevice(ua);

    // 既存セッション検索（同じvisitor_idで30分以内のアクティビティ）
    const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();
    const { data: existingSessions } = await db
      .from('sessions')
      .select('*')
      .eq('visitor_id', visitor_id)
      .eq('site_id', site_id)
      .gte('last_activity_at', cutoff)
      .order('last_activity_at', { ascending: false })
      .limit(1);

    let session = existingSessions?.[0];
    let session_id;
    let isNewSession = false;

    // UTMパラメータが変わった場合は新セッション
    const utmChanged = session && (
      (utm_source && session.utm_source !== utm_source) ||
      (utm_medium && session.utm_medium !== utm_medium) ||
      (utm_campaign && session.utm_campaign !== utm_campaign)
    );

    if (!session || utmChanged) {
      // 新セッション作成
      isNewSession = true;
      session_id = `${visitor_id}_${Date.now()}`;
      const { error: sessErr } = await db.from('sessions').insert({
        session_id,
        visitor_id,
        landing_page: page_url,
        referrer: referrer || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        utm_term: utm_term || null,
        utm_content: utm_content || null,
        user_agent: ua,
        ip_address: ip,
        device_type,
        browser,
        os,
        is_bounce: true,
        page_count: 1,
        site_id,
      });
      if (sessErr) console.error('Session insert error:', sessErr);
    } else {
      // 既存セッション更新
      session_id = session.session_id;
      const newPageCount = (session.page_count || 1) + 1;
      const startedAt = new Date(session.started_at);
      const duration = Math.round((Date.now() - startedAt.getTime()) / 1000);

      const { error: updErr } = await db
        .from('sessions')
        .update({
          last_activity_at: new Date().toISOString(),
          page_count: newPageCount,
          is_bounce: false,
          duration_seconds: duration,
        })
        .eq('session_id', session_id);
      if (updErr) console.error('Session update error:', updErr);
    }

    // ページビュー記録
    const { error: pvErr } = await db.from('pageviews').insert({
      session_id,
      visitor_id,
      page_url,
      page_title: page_title || null,
      referrer: referrer || null,
      site_id,
    });
    if (pvErr) console.error('Pageview insert error:', pvErr);

    return res.status(200).json({
      ok: true,
      session_id,
      is_new_session: isNewSession,
    });
  } catch (err) {
    console.error('Track error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
