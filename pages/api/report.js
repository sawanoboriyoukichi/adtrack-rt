import { getServiceSupabase } from '../../lib/supabase';

// 日付範囲をISO文字列に変換（00:00:00 〜 23:59:59）
function dateRange(from, to) {
  const startDate = from
    ? `${from}T00:00:00.000Z`
    : new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = to
    ? `${to}T23:59:59.999Z`
    : new Date().toISOString();
  return { startDate, endDate };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const {
    type,
    site_id = 'default',
    from,
    to,
    events = '',
    utm_source = '',
    utm_medium = '',
    search = '',
    dimension = 'source',
  } = req.query;

  const db = getServiceSupabase();
  const { startDate, endDate } = dateRange(from, to);
  const eventList = events ? events.split(',').map(e => e.trim()).filter(Boolean) : [];

  try {
    // type=event_names: イベント名一覧
    if (type === 'event_names') {
      const { data, error } = await db
        .from('events')
        .select('event_name')
        .eq('site_id', site_id);
      if (error) throw error;
      const names = [...new Set((data || []).map(e => e.event_name))].sort();
      return res.json({ event_names: names });
    }

    // type=direct: 直接効果レポート（ソース/メディア/キャンペーン別）
    if (type === 'direct') {
      let sessQuery = db
        .from('sessions')
        .select('session_id, utm_source, utm_medium, utm_campaign, is_bounce')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);
      if (utm_source) sessQuery = sessQuery.eq('utm_source', utm_source);
      if (utm_medium) sessQuery = sessQuery.eq('utm_medium', utm_medium);

      const { data: sessions, error: sessErr } = await sessQuery;
      if (sessErr) throw sessErr;

      let cvMap = {};
      if (eventList.length > 0) {
        const { data: evData } = await db
          .from('events')
          .select('session_id, event_name')
          .eq('site_id', site_id)
          .gte('occurred_at', startDate)
          .lte('occurred_at', endDate)
          .in('event_name', eventList);
        (evData || []).forEach(ev => {
          if (!cvMap[ev.session_id]) cvMap[ev.session_id] = new Set();
          cvMap[ev.session_id].add(ev.event_name);
        });
      }

      const groups = {};
      (sessions || []).forEach(s => {
        const src = s.utm_source || '(direct)';
        const med = s.utm_medium || (s.utm_source ? 'referral' : '(none)');
        const cmp = s.utm_campaign || '(not set)';
        const key = `${src}|||${med}|||${cmp}`;
        if (!groups[key]) {
          groups[key] = { source: src, medium: med, campaign: cmp, sessions: 0, bounces: 0, cvCounts: {} };
          eventList.forEach(ev => { groups[key].cvCounts[ev] = 0; });
        }
        groups[key].sessions++;
        if (s.is_bounce) groups[key].bounces++;
        const evSet = cvMap[s.session_id];
        if (evSet) {
          eventList.forEach(ev => { if (evSet.has(ev)) groups[key].cvCounts[ev]++; });
        }
      });

      let rows = Object.values(groups);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r =>
          r.source.toLowerCase().includes(q) ||
          r.medium.toLowerCase().includes(q) ||
          r.campaign.toLowerCase().includes(q)
        );
      }

      const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
      const totalCv = {};
      eventList.forEach(ev => {
        totalCv[ev] = rows.reduce((s, r) => s + (r.cvCounts[ev] || 0), 0);
      });

      const result = rows.sort((a, b) => b.sessions - a.sessions).map(r => ({
        source: r.source,
        medium: r.medium,
        campaign: r.campaign,
        sessions: r.sessions,
        bounceRate: r.sessions > 0 ? ((r.bounces / r.sessions) * 100).toFixed(1) : '0.0',
        cv: r.cvCounts,
      }));

      return res.json({ rows: result, totalSessions, totalCv, uniqueSources: Object.keys(groups).length });
    }

    // type=period: 期間別レポート
    if (type === 'period') {
      let sessQuery = db
        .from('sessions')
        .select('session_id, started_at, is_bounce')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate)
        .order('started_at', { ascending: true });
      if (utm_source) sessQuery = sessQuery.eq('utm_source', utm_source);
      if (utm_medium) sessQuery = sessQuery.eq('utm_medium', utm_medium);

      const { data: sessions, error: sessErr } = await sessQuery;
      if (sessErr) throw sessErr;

      let evByDate = {};
      if (eventList.length > 0 && (sessions || []).length > 0) {
        const { data: evData } = await db
          .from('events')
          .select('session_id, event_name, occurred_at')
          .eq('site_id', site_id)
          .gte('occurred_at', startDate)
          .lte('occurred_at', endDate)
          .in('event_name', eventList);

        const sessDateMap = {};
        (sessions || []).forEach(s => { sessDateMap[s.session_id] = s.started_at.substring(0, 10); });

        const counted = new Set();
        (evData || []).forEach(ev => {
          const date = sessDateMap[ev.session_id];
          if (!date) return;
          const key = `${ev.session_id}|${ev.event_name}`;
          if (counted.has(key)) return;
          counted.add(key);
          if (!evByDate[date]) evByDate[date] = {};
          evByDate[date][ev.event_name] = (evByDate[date][ev.event_name] || 0) + 1;
        });
      }

      const dayMap = {};
      (sessions || []).forEach(s => {
        const date = s.started_at.substring(0, 10);
        if (!dayMap[date]) dayMap[date] = { date, sessions: 0, bounces: 0 };
        dayMap[date].sessions++;
        if (s.is_bounce) dayMap[date].bounces++;
      });

      const rows = Object.values(dayMap)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(d => ({ date: d.date, sessions: d.sessions, cv: evByDate[d.date] || {} }));

      const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
      const totalCv = {};
      eventList.forEach(ev => {
        totalCv[ev] = rows.reduce((s, r) => s + (r.cv[ev] || 0), 0);
      });

      return res.json({ rows, totalSessions, totalCv });
    }

    // type=hourly: 時間帯別レポート
    if (type === 'hourly') {
      let sessQuery = db
        .from('sessions')
        .select('session_id, started_at')
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);
      if (utm_source) sessQuery = sessQuery.eq('utm_source', utm_source);
      if (utm_medium) sessQuery = sessQuery.eq('utm_medium', utm_medium);

      const { data: sessions, error: sessErr } = await sessQuery;
      if (sessErr) throw sessErr;

      const hourMap = {};
      for (let h = 0; h < 24; h++) hourMap[h] = 0;

      (sessions || []).forEach(s => {
        const utcHour = new Date(s.started_at).getUTCHours();
        const jstHour = (utcHour + 9) % 24;
        hourMap[jstHour]++;
      });

      const totalSessions = Object.values(hourMap).reduce((a, b) => a + b, 0);
      const maxEntry = Object.entries(hourMap).sort((a, b) => b[1] - a[1])[0];

      const rows = Object.entries(hourMap).map(([h, cnt]) => ({
        hour: String(h).padStart(2, '0') + ':00',
        sessions: cnt,
        pct: totalSessions > 0 ? ((cnt / totalSessions) * 100).toFixed(1) : '0.0',
      }));

      return res.json({
        rows,
        totalSessions,
        peakHour: maxEntry ? String(maxEntry[0]).padStart(2, '0') + ':00' : '00:00',
        peakCount: maxEntry ? maxEntry[1] : 0,
      });
    }

    // type=params: パラメーター別レポート
    if (type === 'params') {
      const dimField = {
        source: 'utm_source',
        medium: 'utm_medium',
        campaign: 'utm_campaign',
        term: 'utm_term',
        content: 'utm_content',
      }[dimension] || 'utm_source';

      const { data: sessions, error: sessErr } = await db
        .from('sessions')
        .select(`session_id, ${dimField}, is_bounce`)
        .eq('site_id', site_id)
        .gte('started_at', startDate)
        .lte('started_at', endDate);
      if (sessErr) throw sessErr;

      let cvMap = {};
      if (eventList.length > 0) {
        const { data: evData } = await db
          .from('events')
          .select('session_id, event_name')
          .eq('site_id', site_id)
          .gte('occurred_at', startDate)
          .lte('occurred_at', endDate)
          .in('event_name', eventList);
        (evData || []).forEach(ev => {
          if (!cvMap[ev.session_id]) cvMap[ev.session_id] = new Set();
          cvMap[ev.session_id].add(ev.event_name);
        });
      }

      const groups = {};
      (sessions || []).forEach(s => {
        const val = s[dimField] || '(未設定)';
        if (!groups[val]) {
          groups[val] = { value: val, sessions: 0, bounces: 0, cvCounts: {} };
          eventList.forEach(ev => { groups[val].cvCounts[ev] = 0; });
        }
        groups[val].sessions++;
        if (s.is_bounce) groups[val].bounces++;
        const evSet = cvMap[s.session_id];
        if (evSet) {
          eventList.forEach(ev => { if (evSet.has(ev)) groups[val].cvCounts[ev]++; });
        }
      });

      let rows = Object.values(groups);
      if (search) {
        const q = search.toLowerCase();
        rows = rows.filter(r => r.value.toLowerCase().includes(q));
      }

      const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
      const totalCv = {};
      eventList.forEach(ev => {
        totalCv[ev] = rows.reduce((s, r) => s + (r.cvCounts[ev] || 0), 0);
      });

      const result = rows.sort((a, b) => b.sessions - a.sessions).map(r => ({
        value: r.value,
        sessions: r.sessions,
        bounceRate: r.sessions > 0 ? ((r.bounces / r.sessions) * 100).toFixed(1) : '0.0',
        pct: totalSessions > 0 ? ((r.sessions / totalSessions) * 100).toFixed(1) : '0.0',
        cv: r.cvCounts,
      }));

      return res.json({ rows: result, totalSessions, totalCv });
    }

    return res.status(400).json({ error: 'Invalid type' });
  } catch (err) {
    console.error('Report API error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
