import { getServiceSupabase } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type, site_id = 'default', start, end, limit = 500 } = req.query;
  const db = getServiceSupabase();

  // 日付範囲のデフォルト（過去28日）
  const endDate = end || new Date().toISOString();
  const startDate = start || new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();

  try {
    if (type === 'summary') {
      // サマリー統計
      const { data: sessions, error } = await db
        .from('sessions')
        .select('session_id, visitor_id, is_bounce, page_count, duration_seconds')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      if (error) throw error;

      const totalSessions = sessions.length;
      const uniqueVisitors = new Set(sessions.map(s => s.visitor_id)).size;
      const bounces = sessions.filter(s => s.is_bounce).length;
      const bounceRate = totalSessions > 0 ? ((bounces / totalSessions) * 100).toFixed(1) : '0.0';
      const totalPageviews = sessions.reduce((s, r) => s + (r.page_count || 0), 0);
      const avgDuration = totalSessions > 0
        ? Math.round(sessions.reduce((s, r) => s + (r.duration_seconds || 0), 0) / totalSessions)
        : 0;

      return res.json({ totalSessions, uniqueVisitors, bounceRate, totalPageviews, avgDuration });
    }

    if (type === 'sessions') {
      // セッション一覧
      const { data, error } = await db
        .from('sessions')
        .select('*')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .order('started_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) throw error;
      return res.json(data);
    }

    if (type === 'pageviews') {
      // ページ別集計
      const { data, error } = await db
        .from('pageviews')
        .select('page_url, page_title, session_id')
        .eq('site_id', site_id)
        .gte('viewed_at', startDate)
        .lte('viewed_at', endDate);

      if (error) throw error;

      const pageMap = {};
      data.forEach(pv => {
        const url = pv.page_url;
        if (!pageMap[url]) pageMap[url] = { page_url: url, page_title: pv.page_title, views: 0, sessions: new Set() };
        pageMap[url].views++;
        pageMap[url].sessions.add(pv.session_id);
      });

      const result = Object.values(pageMap)
        .map(p => ({ page_url: p.page_url, page_title: p.page_title, views: p.views, unique_sessions: p.sessions.size }))
        .sort((a, b) => b.views - a.views);

      return res.json(result);
    }

    if (type === 'events') {
      // イベント集計
      const { data, error } = await db
        .from('events')
        .select('event_name, event_category, event_label, session_id, visitor_id')
        .eq('site_id', site_id)
        .gte('occurred_at', startDate)
        .lte('occurred_at', endDate);

      if (error) throw error;

      const eventMap = {};
      data.forEach(ev => {
        const key = ev.event_name;
        if (!eventMap[key]) eventMap[key] = { event_name: key, count: 0, unique_visitors: new Set(), sessions: new Set() };
        eventMap[key].count++;
        eventMap[key].unique_visitors.add(ev.visitor_id);
        eventMap[key].sessions.add(ev.session_id);
      });

      const result = Object.values(eventMap)
        .map(e => ({ event_name: e.event_name, count: e.count, unique_visitors: e.unique_visitors.size, unique_sessions: e.sessions.size }))
        .sort((a, b) => b.count - a.count);

      return res.json(result);
    }

    if (type === 'eventsbyattribution') {
      // アトリビューション別イベント
      const { data: sessions } = await db
        .from('sessions')
        .select('session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      const sessionMap = {};
      (sessions || []).forEach(s => { sessionMap[s.session_id] = s; });

      const { data: events } = await db
        .from('events')
        .select('event_name, session_id')
        .eq('site_id', site_id)
        .gte('occurred_at', startDate)
        .lte('occurred_at', endDate);

      const result = (events || []).map(ev => {
        const sess = sessionMap[ev.session_id] || {};
        return {
          eventName: ev.event_name,
          source: sess.utm_source || '(direct)',
          medium: sess.utm_medium || '(none)',
          campaign: sess.utm_campaign || '(not set)',
          term: sess.utm_term || '(not set)',
          content: sess.utm_content || '(not set)',
          count: 1,
        };
      });

      return res.json(result);
    }

    if (type === 'params') {
      // パラメーター別セッション集計
      const { data, error } = await db
        .from('sessions')
        .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, is_bounce, page_count, duration_seconds')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);

      if (error) throw error;

      const result = (data || []).map(s => ({
        source: s.utm_source || '(direct)',
        medium: s.utm_medium || '(none)',
        campaign: s.utm_campaign || '(not set)',
        term: s.utm_term || '(not set)',
        content: s.utm_content || '(not set)',
        sessions: 1,
        bounceRate: s.is_bounce ? '100.0' : '0.0',
      }));

      return res.json(result);
    }

    if (type === 'timeline') {
      // 日別セッション推移
      const { data, error } = await db
        .from('sessions')
        .select('started_at, visitor_id, is_bounce')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .order('started_at', { ascending: true });

      if (error) throw error;

      const dayMap = {};
      (data || []).forEach(s => {
        const day = s.started_at.substring(0, 10);
        if (!dayMap[day]) dayMap[day] = { date: day, sessions: 0, visitors: new Set(), bounces: 0 };
        dayMap[day].sessions++;
        dayMap[day].visitors.add(s.visitor_id);
        if (s.is_bounce) dayMap[day].bounces++;
      });

      const result = Object.values(dayMap).map(d => ({
        date: d.date,
        sessions: d.sessions,
        visitors: d.visitors.size,
        bounceRate: d.sessions > 0 ? ((d.bounces / d.sessions) * 100).toFixed(1) : '0.0',
      }));

      return res.json(result);
    }

    return res.status(400).json({ error: 'Invalid type. Use: summary, sessions, pageviews, events, eventsbyattribution, params, timeline' });
  } catch (err) {
    console.error('Report API error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
