import { getServiceSupabase } from '../../lib/supabase';

// GA4スタイルの日付文字列をYYYY-MM-DDに変換
function resolveGA4Date(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fmt = (d) => d.toISOString().substring(0, 10);
  if (dateStr === 'today') return fmt(today);
  if (dateStr === 'yesterday') { const d = new Date(today); d.setDate(d.getDate() - 1); return fmt(d); }
  const m = dateStr.match(/^(\d+)daysAgo$/);
  if (m) { const d = new Date(today); d.setDate(d.getDate() - parseInt(m[1])); return fmt(d); }
  return dateStr; // already YYYY-MM-DD
}

function parseDates(q) {
  // Accept startDate/endDate (GA4 format) or from/to (YYYY-MM-DD)
  const start = resolveGA4Date(q.startDate || q.from) || resolveGA4Date('28daysAgo');
  const end = resolveGA4Date(q.endDate || q.to) || resolveGA4Date('today');
  return {
    startISO: `${start}T00:00:00.000Z`,
    endISO: `${end}T23:59:59.999Z`,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { type, site_id = 'default', filterSource = '', filterMedium = '' } = req.query;
  const { startISO, endISO } = parseDates(req.query);
  const db = getServiceSupabase();

  try {
    // ─── type=attribution : UTM別セッション集計（直接効果・パラメーター別レポート用）─────
    if (type === 'attribution' || type === 'params') {
      const { data: sessions, error } = await db
        .from('sessions')
        .select('utm_source, utm_medium, utm_campaign, utm_term, utm_content, is_bounce')
        .eq('site_id', site_id)
        .gte('started_at', startISO)
        .lte('started_at', endISO);
      if (error) throw error;

      const groups = {};
      (sessions || []).forEach(s => {
        const src = s.utm_source || '(direct)';
        const med = s.utm_medium || (s.utm_source ? 'referral' : '(none)');
        const cmp = s.utm_campaign || '(not set)';
        const term = s.utm_term || '(not set)';
        const content = s.utm_content || '(not set)';
        const key = `${src}|||${med}|||${cmp}|||${term}|||${content}`;
        if (!groups[key]) groups[key] = { source: src, medium: med, campaign: cmp, term, content, sessions: 0, bounces: 0 };
        groups[key].sessions++;
        if (s.is_bounce) groups[key].bounces++;
      });

      return res.json(Object.values(groups).map(r => ({
        source: r.source, medium: r.medium, campaign: r.campaign, term: r.term, content: r.content,
        sessions: r.sessions,
        bounceRate: r.sessions > 0 ? ((r.bounces / r.sessions) * 100).toFixed(1) : '0.0',
      })).sort((a, b) => b.sessions - a.sessions));
    }

    // ─── type=eventsbyattribution : UTM×イベント集計 ─────────────────────────────
    if (type === 'eventsbyattribution') {
      const { data: sessions, error: sErr } = await db
        .from('sessions')
        .select('session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content')
        .eq('site_id', site_id)
        .gte('started_at', startISO)
        .lte('started_at', endISO);
      if (sErr) throw sErr;

      const sessMap = {};
      (sessions || []).forEach(s => {
        sessMap[s.session_id] = {
          source: s.utm_source || '(direct)',
          medium: s.utm_medium || (s.utm_source ? 'referral' : '(none)'),
          campaign: s.utm_campaign || '(not set)',
          term: s.utm_term || '(not set)',
          content: s.utm_content || '(not set)',
        };
      });

      const { data: events, error: eErr } = await db
        .from('events')
        .select('session_id, event_name')
        .eq('site_id', site_id)
        .gte('occurred_at', startISO)
        .lte('occurred_at', endISO);
      if (eErr) throw eErr;

      const groups = {};
      (events || []).forEach(ev => {
        const utm = sessMap[ev.session_id];
        if (!utm) return;
        const key = `${utm.source}|||${utm.medium}|||${utm.campaign}|||${utm.term}|||${utm.content}|||${ev.event_name}`;
        if (!groups[key]) groups[key] = { ...utm, eventName: ev.event_name, count: 0 };
        groups[key].count++;
      });

      return res.json(Object.values(groups));
    }

    // ─── type=sessions : 日別セッション数 ────────────────────────────────────────
    if (type === 'sessions') {
      let q = db.from('sessions').select('started_at')
        .eq('site_id', site_id).gte('started_at', startISO).lte('started_at', endISO);
      if (filterSource) q = q.eq('utm_source', filterSource);
      if (filterMedium) q = q.eq('utm_medium', filterMedium);
      const { data, error } = await q;
      if (error) throw error;

      const dayMap = {};
      (data || []).forEach(s => { const d = s.started_at.substring(0, 10); dayMap[d] = (dayMap[d] || 0) + 1; });
      return res.json(Object.entries(dayMap).map(([date, sessions]) => ({ date, sessions })).sort((a, b) => a.date.localeCompare(b.date)));
    }

    // ─── type=eventnames : イベント名一覧 ────────────────────────────────────────
    if (type === 'eventnames') {
      let sessionIds = null;
      if (filterSource || filterMedium) {
        let sq = db.from('sessions').select('session_id').eq('site_id', site_id)
          .gte('started_at', startISO).lte('started_at', endISO);
        if (filterSource) sq = sq.eq('utm_source', filterSource);
        if (filterMedium) sq = sq.eq('utm_medium', filterMedium);
        const { data: sess } = await sq;
        sessionIds = (sess || []).map(s => s.session_id);
        if (sessionIds.length === 0) return res.json([]);
      }

      let eq = db.from('events').select('event_name').eq('site_id', site_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO);
      if (sessionIds) eq = eq.in('session_id', sessionIds);
      const { data, error } = await eq;
      if (error) throw error;

      const counts = {};
      (data || []).forEach(e => { counts[e.event_name] = (counts[e.event_name] || 0) + 1; });
      return res.json(Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    }

    // ─── type=eventsbydate : 日付別イベント数 ────────────────────────────────────
    if (type === 'eventsbydate') {
      let sessionIds = null;
      if (filterSource || filterMedium) {
        let sq = db.from('sessions').select('session_id').eq('site_id', site_id)
          .gte('started_at', startISO).lte('started_at', endISO);
        if (filterSource) sq = sq.eq('utm_source', filterSource);
        if (filterMedium) sq = sq.eq('utm_medium', filterMedium);
        const { data: sess } = await sq;
        sessionIds = (sess || []).map(s => s.session_id);
        if (sessionIds.length === 0) return res.json([]);
      }

      let eq = db.from('events').select('event_name, occurred_at').eq('site_id', site_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO);
      if (sessionIds) eq = eq.in('session_id', sessionIds);
      const { data, error } = await eq;
      if (error) throw error;

      const groups = {};
      (data || []).forEach(e => {
        const date = e.occurred_at.substring(0, 10);
        const key = `${date}|||${e.event_name}`;
        if (!groups[key]) groups[key] = { date, eventName: e.event_name, count: 0 };
        groups[key].count++;
      });

      return res.json(Object.values(groups));
    }

    // ─── type=hourly : 時間帯別セッション数 ──────────────────────────────────────
    if (type === 'hourly') {
      let q = db.from('sessions').select('started_at')
        .eq('site_id', site_id).gte('started_at', startISO).lte('started_at', endISO);
      if (filterSource) q = q.eq('utm_source', filterSource);
      if (filterMedium) q = q.eq('utm_medium', filterMedium);
      const { data, error } = await q;
      if (error) throw error;

      const hourMap = {};
      (data || []).forEach(s => {
        const jstHour = (new Date(s.started_at).getUTCHours() + 9) % 24;
        hourMap[jstHour] = (hourMap[jstHour] || 0) + 1;
      });

      return res.json(Array.from({ length: 24 }, (_, h) => ({ hour: h, sessions: hourMap[h] || 0 })));
    }

    // ─── type=eventsbyhour : 時間帯別イベント数 ───────────────────────────────────
    if (type === 'eventsbyhour') {
      let sessionIds = null;
      if (filterSource || filterMedium) {
        let sq = db.from('sessions').select('session_id').eq('site_id', site_id)
          .gte('started_at', startISO).lte('started_at', endISO);
        if (filterSource) sq = sq.eq('utm_source', filterSource);
        if (filterMedium) sq = sq.eq('utm_medium', filterMedium);
        const { data: sess } = await sq;
        sessionIds = (sess || []).map(s => s.session_id);
        if (sessionIds.length === 0) return res.json([]);
      }

      let eq = db.from('events').select('event_name, occurred_at').eq('site_id', site_id)
        .gte('occurred_at', startISO).lte('occurred_at', endISO);
      if (sessionIds) eq = eq.in('session_id', sessionIds);
      const { data, error } = await eq;
      if (error) throw error;

      const groups = {};
      (data || []).forEach(e => {
        const jstHour = (new Date(e.occurred_at).getUTCHours() + 9) % 24;
        const key = `${jstHour}|||${e.event_name}`;
        if (!groups[key]) groups[key] = { hour: jstHour, eventName: e.event_name, count: 0 };
        groups[key].count++;
      });

      return res.json(Object.values(groups));
    }

    return res.status(400).json({ error: `Invalid type: ${type}` });

  } catch (err) {
    console.error('Report API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
