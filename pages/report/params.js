import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';
import MicroConversionSelector, { getEventLabel } from '../../components/MicroConversionSelector';

const PARAM_TYPES = [
  { label: 'ソース', key: 'source', desc: 'utm_source' },
  { label: 'メディア', key: 'medium', desc: 'utm_medium' },
  { label: 'キャンペーン', key: 'campaign', desc: 'utm_campaign' },
  { label: 'キャンペーン用語', key: 'term', desc: 'utm_term' },
  { label: 'コンテンツ', key: 'content', desc: 'utm_content' },
];
const EVENT_COLORS = ['#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db', '#f39c12', '#2ecc71', '#e91e63'];
const DEFAULT_SELECTED = ['email_registration', 'line_registration'];
const SELECTED_STORAGE_KEY = 'adtrack_selected_cv';

export default function ParamsReport() {
  const [startDate, setStartDate] = useState('28daysAgo');
  const [endDate, setEndDate] = useState('today');
  const [siteId, setSiteId] = useState('default');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [eventsByAttrib, setEventsByAttrib] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState(DEFAULT_SELECTED);
  const [error, setError] = useState(null);
  const [activeParam, setActiveParam] = useState('source');
  const [sortKey, setSortKey] = useState('sessions');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSite = localStorage.getItem('adtrack_site_id');
      if (savedSite) setSiteId(savedSite);
      try {
        const saved = localStorage.getItem(SELECTED_STORAGE_KEY);
        if (saved) { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) setSelectedEvents(parsed); }
      } catch {}
    }
  }, []);

  const handleSelectedEventsChange = (events) => {
    setSelectedEvents(events);
    try { localStorage.setItem(SELECTED_STORAGE_KEY, JSON.stringify(events)); } catch {}
  };

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const p = `startDate=${startDate}&endDate=${endDate}&site_id=${siteId}`;
      const [paramsRes, evByAttribRes] = await Promise.all([
        fetch(`/api/report?type=attribution&${p}`),
        fetch(`/api/report?type=eventsbyattribution&${p}`),
      ]);
      const paramsData = await paramsRes.json();
      const evData = await evByAttribRes.json();
      setData(paramsData);
      setEventsByAttrib(evData);
      const eventMap = {};
      evData.forEach(r => { eventMap[r.eventName] = (eventMap[r.eventName] || 0) + r.count; });
      setAvailableEvents(Object.entries(eventMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key) => { if (sortKey === key) setSortDesc(!sortDesc); else { setSortKey(key); setSortDesc(true); } };

  const aggregated = (() => {
    const map = {};
    data.forEach(row => {
      const key = row[activeParam] || '(not set)';
      if (!map[key]) map[key] = { label: key, sessions: 0, bounceRateSum: 0, count: 0, eventKeys: {} };
      map[key].sessions += row.sessions;
      map[key].bounceRateSum += parseFloat(row.bounceRate) * row.sessions;
      map[key].count += row.sessions;
      const attribKey = `${row.source}|||${row.medium}|||${row.campaign}|||${row.term}|||${row.content}`;
      eventsByAttrib.filter(e => `${e.source}|||${e.medium}|||${e.campaign}|||${e.term}|||${e.content}` === attribKey)
        .forEach(e => { map[key].eventKeys[e.eventName] = (map[key].eventKeys[e.eventName] || 0) + e.count; });
    });
    return Object.values(map).map(r => ({ ...r, bounceRate: r.count > 0 ? (r.bounceRateSum / r.count).toFixed(1) : '0.0' }));
  })();

  const filtered = aggregated.filter(r => !filterText || r.label.toLowerCase().includes(filterText.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    if (selectedEvents.includes(sortKey)) {
      return sortDesc ? (b.eventKeys?.[sortKey] ?? 0) - (a.eventKeys?.[sortKey] ?? 0) : (a.eventKeys?.[sortKey] ?? 0) - (b.eventKeys?.[sortKey] ?? 0);
    }
    const va = parseFloat(a[sortKey]) || 0, vb = parseFloat(b[sortKey]) || 0;
    return sortDesc ? vb - va : va - vb;
  });

  const totals = filtered.reduce((acc, r) => ({ sessions: acc.sessions + r.sessions }), { sessions: 0 });
  const maxSessions = Math.max(...sorted.map(r => r.sessions), 1);

  const exportCSV = () => {
    const paramLabel = PARAM_TYPES.find(p => p.key === activeParam)?.label || activeParam;
    const headers = [paramLabel, 'セッション数', '直帰率(%)', '構成比(%)', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', getEventLabel(e) + '(率%)'])];
    const rows = sorted.map(r => {
      const share = totals.sessions > 0 ? (r.sessions / totals.sessions * 100).toFixed(1) : '0.0';
      const base = [r.label, r.sessions, r.bounceRate, share];
      const evCols = selectedEvents.flatMap(e => {
        const cnt = r.eventKeys?.[e] ?? 0;
        const rate = r.sessions > 0 ? ((cnt / r.sessions) * 100).toFixed(1) : '0.0';
        return [cnt, rate];
      });
      return [...base, ...evCols].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `params_${activeParam}_${startDate}_${endDate}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }) => sortKey !== col ? <span style={{ color: '#bbb', marginLeft: '3px' }}>↕</span> : <span style={{ color: '#1a8fc1', marginLeft: '3px' }}>{sortDesc ? '↓' : '↑'}</span>;
  const thBase = { padding: '9px 10px', fontSize: '11px', fontWeight: 'bold', color: '#555', backgroundColor: '#f5f7fa', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', userSelect: 'none', cursor: 'pointer' };

  return (
    <Layout title="パラメーター別レポート">
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} loading={loading} onRefresh={fetchData} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" placeholder="値で絞り込み..." value={filterText} onChange={e => setFilterText(e.target.value)}
            style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '180px' }} />
          <MicroConversionSelector events={availableEvents} selected={selectedEvents} onChange={handleSelectedEventsChange} />
          <button onClick={exportCSV} disabled={sorted.length === 0}
            style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: 'white', cursor: sorted.length === 0 ? 'default' : 'pointer', opacity: sorted.length === 0 ? 0.5 : 1 }}>
            📥 CSV
          </button>
        </div>
      </div>

      {error && <div style={{ backgroundColor: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '6px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' }}>エラー: {error}</div>}

      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {PARAM_TYPES.map(pt => (
            <button key={pt.key} onClick={() => { setActiveParam(pt.key); setFilterText(''); }}
              style={{ padding: '12px 20px', fontSize: '13px', fontWeight: activeParam === pt.key ? 'bold' : 'normal', color: activeParam === pt.key ? '#1a8fc1' : '#555', backgroundColor: 'transparent', border: 'none', borderBottom: activeParam === pt.key ? '3px solid #1a8fc1' : '3px solid transparent', cursor: 'pointer' }}>
              {pt.label} <span style={{ fontSize: '11px', color: '#999' }}>({pt.desc})</span>
            </button>
          ))}
        </div>

        {/* サマリーバー */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: '20px', fontSize: '13px', color: '#555', backgroundColor: '#fafafa', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
          <span>セッション合計: <strong style={{ color: '#1a8fc1' }}>{loading ? '—' : totals.sessions.toLocaleString()}</strong></span>
          {selectedEvents.map((ev, i) => {
            const total = filtered.reduce((s, r) => s + (r.eventKeys?.[ev] || 0), 0);
            const rate = totals.sessions > 0 ? ((total / totals.sessions) * 100).toFixed(1) : '0.0';
            return <span key={ev} style={{ color: EVENT_COLORS[i % EVENT_COLORS.length] }}>{getEventLabel(ev)}: <strong>{total.toLocaleString()}件</strong> ({rate}%)</span>;
          })}
          <span style={{ marginLeft: 'auto', color: '#888' }}>{filtered.length} 件</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thBase, textAlign: 'left' }}>{PARAM_TYPES.find(p => p.key === activeParam)?.label}</th>
                <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('sessions')}>セッション数 <SortIcon col="sessions" /></th>
                <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('bounceRate')}>直帰率 <SortIcon col="bounceRate" /></th>
                <th style={{ ...thBase, textAlign: 'right' }}>構成比</th>
                {selectedEvents.map((ev, i) => (
                  <th key={ev} style={{ ...thBase, textAlign: 'right', backgroundColor: '#fef9e7', borderBottom: '2px solid #f9ca24' }} onClick={() => handleSort(ev)}>
                    <div style={{ fontSize: '11px', color: EVENT_COLORS[i % EVENT_COLORS.length] }}>{getEventLabel(ev)}</div>
                    <SortIcon col={ev} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 + selectedEvents.length }).map((_, j) => (
                  <td key={j} style={{ padding: '10px 10px' }}><div style={{ height: '13px', backgroundColor: '#f0f0f0', borderRadius: '3px' }} /></td>
                ))}</tr>
              )) : sorted.length === 0 ? (
                <tr><td colSpan={4 + selectedEvents.length} style={{ textAlign: 'center', padding: '32px', color: '#888', fontSize: '13px' }}>データがありません</td></tr>
              ) : sorted.map((row, i) => {
                const share = totals.sessions > 0 ? (row.sessions / totals.sessions * 100).toFixed(1) : '0.0';
                return (
                  <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e8f4fb'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#fafafa' : 'white'}>
                    <td style={{ padding: '8px 10px', fontSize: '13px' }}>
                      <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '3px', backgroundColor: '#e8f4fb', color: '#1a8fc1', fontSize: '12px' }}>
                        {row.label === '(not set)' || row.label === 'not set' ? '(未設定)' : row.label}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <div style={{ height: '7px', width: `${Math.round((row.sessions / maxSessions) * 50)}px`, backgroundColor: '#1a8fc1', borderRadius: '2px', opacity: 0.5 }} />
                        {row.sessions.toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right', color: parseFloat(row.bounceRate) > 70 ? '#e53935' : '#333' }}>{row.bounceRate}%</td>
                    <td style={{ padding: '8px 10px', fontSize: '12px', textAlign: 'right', color: '#888' }}>{share}%</td>
                    {selectedEvents.map((ev, j) => {
                      const cnt = row.eventKeys?.[ev] ?? 0;
                      const rate = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                      const col = EVENT_COLORS[j % EVENT_COLORS.length];
                      return (
                        <td key={ev} style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: '#fffef5' }}>
                          <div style={{ fontSize: '13px', fontWeight: cnt > 0 ? 'bold' : 'normal', color: cnt > 0 ? col : '#ccc' }}>{cnt > 0 ? cnt.toLocaleString() + '件' : '—'}</div>
                          {cnt > 0 && <div style={{ fontSize: '11px', color: col, opacity: 0.8 }}>{rate}%</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
