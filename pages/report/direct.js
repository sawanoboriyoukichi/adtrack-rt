import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';
import MicroConversionSelector, { getEventLabel } from '../../components/MicroConversionSelector';

const DEFAULT_SELECTED = ['email_registration', 'line_registration'];
const EVENT_COLORS = ['#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db', '#f39c12', '#2ecc71', '#e91e63'];
const SELECTED_STORAGE_KEY = 'adtrack_selected_cv';
const PARAM_TYPES = [
  { label: 'ソース', key: 'source', desc: 'utm_source' },
  { label: 'メディア', key: 'medium', desc: 'utm_medium' },
  { label: 'キャンペーン', key: 'campaign', desc: 'utm_campaign' },
  { label: 'キャンペーン用語', key: 'term', desc: 'utm_term' },
  { label: 'コンテンツ', key: 'content', desc: 'utm_content' },
];

function exportToCSV(rows, selectedEvents, filename) {
  const baseHeaders = ['ソース', 'メディア', 'キャンペーン', 'キャンペーン用語', 'コンテンツ', 'セッション数', '直帰率(%)'];
  const eventHeaders = selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', getEventLabel(e) + '(CVR%)']);
  const headers = [...baseHeaders, ...eventHeaders];
  const csvRows = rows.map(row => {
    const notSet = v => (v === '(not set)' ? '' : v);
    const base = [row.source, row.medium, notSet(row.campaign), notSet(row.term), notSet(row.content), row.sessions, row.bounceRate];
    const evCols = selectedEvents.flatMap(e => {
      const cnt = row.events?.[e] ?? 0;
      const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(2) : '0.00';
      return [cnt, cvr];
    });
    return [...base, ...evCols].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function exportAggCSV(rows, selectedEvents, activeView, filename) {
  const paramLabel = PARAM_TYPES.find(p => p.key === activeView)?.label || activeView;
  const headers = [paramLabel, 'セッション数', '直帰率(%)', '構成比(%)', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', getEventLabel(e) + '(CVR%)'])];
  const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
  const csvRows = rows.map(row => {
    const share = totalSessions > 0 ? (row.sessions / totalSessions * 100).toFixed(1) : '0.0';
    const base = [row.label, row.sessions, row.bounceRate, share];
    const evCols = selectedEvents.flatMap(e => {
      const cnt = row.events?.[e] ?? 0;
      const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
      return [cnt, cvr];
    });
    return [...base, ...evCols].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function DirectReport() {
  const [startDate, setStartDate] = useState('28daysAgo');
  const [endDate, setEndDate] = useState('today');
  const [siteId, setSiteId] = useState('default');
  const [loading, setLoading] = useState(true);
  const [attribution, setAttribution] = useState([]);
  const [eventsByAttrib, setEventsByAttrib] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState(DEFAULT_SELECTED);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('sessions');
  const [sortDesc, setSortDesc] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeView, setActiveView] = useState('all');

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
      const [attrRes, evRes] = await Promise.all([
        fetch(`/api/report?type=attribution&startDate=${startDate}&endDate=${endDate}&site_id=${siteId}`),
        fetch(`/api/report?type=eventsbyattribution&startDate=${startDate}&endDate=${endDate}&site_id=${siteId}`),
      ]);
      const attrData = await attrRes.json();
      const evData = await evRes.json();
      setAttribution(attrData);
      setEventsByAttrib(evData);
      const eventMap = {};
      evData.forEach(r => { eventMap[r.eventName] = (eventMap[r.eventName] || 0) + r.count; });
      setAvailableEvents(Object.entries(eventMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }, [startDate, endDate, siteId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const mergedData = attribution.map(row => {
    const key = `${row.source}|||${row.medium}|||${row.campaign}|||${row.term}|||${row.content}`;
    const events = {};
    eventsByAttrib.filter(e => `${e.source}|||${e.medium}|||${e.campaign}|||${e.term}|||${e.content}` === key)
      .forEach(e => { events[e.eventName] = (events[e.eventName] || 0) + e.count; });
    return { ...row, events };
  });

  const aggregatedData = (() => {
    if (activeView === 'all') return null;
    const map = {};
    mergedData.forEach(row => {
      const key = row[activeView] || '(not set)';
      if (!map[key]) map[key] = { label: key, sessions: 0, bounceRateSum: 0, count: 0, events: {} };
      map[key].sessions += row.sessions;
      map[key].bounceRateSum += parseFloat(row.bounceRate || 0) * row.sessions;
      map[key].count += row.sessions;
      Object.entries(row.events || {}).forEach(([ev, cnt]) => { map[key].events[ev] = (map[key].events[ev] || 0) + cnt; });
    });
    return Object.values(map).map(r => ({ ...r, bounceRate: r.count > 0 ? (r.bounceRateSum / r.count).toFixed(1) : '0.0' }));
  })();

  const filtered = activeView === 'all'
    ? mergedData.filter(row => {
        if (!filterText) return true;
        const q = filterText.toLowerCase();
        return row.source.toLowerCase().includes(q) || row.medium.toLowerCase().includes(q) ||
          row.campaign.toLowerCase().includes(q) || (row.term || '').toLowerCase().includes(q) ||
          (row.content || '').toLowerCase().includes(q);
      })
    : (aggregatedData || []).filter(r => !filterText || r.label.toLowerCase().includes(filterText.toLowerCase()));

  const sorted = [...filtered].sort((a, b) => {
    const evA = a.events || {}; const evB = b.events || {};
    if (selectedEvents.includes(sortKey)) return sortDesc ? (evB[sortKey] ?? 0) - (evA[sortKey] ?? 0) : (evA[sortKey] ?? 0) - (evB[sortKey] ?? 0);
    const va = parseFloat(a[sortKey]) || 0, vb = parseFloat(b[sortKey]) || 0;
    return sortDesc ? vb - va : va - vb;
  });

  const handleSort = (key) => { if (sortKey === key) setSortDesc(!sortDesc); else { setSortKey(key); setSortDesc(true); } };

  const totals = filtered.reduce((acc, row) => ({
    sessions: acc.sessions + row.sessions,
    events: selectedEvents.reduce((ev, name) => ({ ...ev, [name]: (ev[name] || 0) + (row.events?.[name] || 0) }), acc.events || {}),
  }), { sessions: 0, events: {} });

  const maxSessions = Math.max(...sorted.map(r => r.sessions), 1);
  const SortIcon = ({ col }) => sortKey !== col ? <span style={{ color: '#bbb', marginLeft: '3px' }}>↕</span> : <span style={{ color: '#1a8fc1', marginLeft: '3px' }}>{sortDesc ? '↓' : '↑'}</span>;
  const thBase = { padding: '9px 10px', fontSize: '11px', fontWeight: 'bold', color: '#555', backgroundColor: '#f5f7fa', borderBottom: '2px solid #ddd', whiteSpace: 'nowrap', userSelect: 'none', cursor: 'pointer' };

  return (
    <Layout title="直接効果レポート">
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} loading={loading} onRefresh={fetchData} />
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="text" placeholder={activeView === 'all' ? 'ソース / メディア / キャンペーン / 用語 / コンテンツ' : '値で絞り込み...'} value={filterText} onChange={e => setFilterText(e.target.value)}
            style={{ padding: '5px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '250px' }} />
          {activeView === 'all' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#555', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={showDetails} onChange={e => setShowDetails(e.target.checked)} style={{ cursor: 'pointer' }} />
              用語/コンテンツ列
            </label>
          )}
          <MicroConversionSelector events={availableEvents} selected={selectedEvents} onChange={handleSelectedEventsChange} />
          <button onClick={() => { if (activeView === 'all') exportToCSV(sorted, selectedEvents, `direct_${startDate}_${endDate}.csv`); else exportAggCSV(sorted, selectedEvents, activeView, `direct_${activeView}_${startDate}_${endDate}.csv`); }}
            disabled={sorted.length === 0}
            style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: 'white', cursor: sorted.length === 0 ? 'default' : 'pointer', opacity: sorted.length === 0 ? 0.5 : 1 }}>
            📥 CSV
          </button>
        </div>
      </div>

      {error && <div style={{ backgroundColor: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '6px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' }}>エラー: {error}</div>}

      {/* サマリーカード */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '110px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: '3px solid #1a8fc1' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>セッション数</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a8fc1' }}>{loading ? '—' : totals.sessions.toLocaleString()}</div>
        </div>
        <div style={{ flex: '1', minWidth: '100px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: '3px solid #8e44ad' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>流入元数</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#8e44ad' }}>{loading ? '—' : filtered.length + ' 件'}</div>
        </div>
        {selectedEvents.map((ev, i) => {
          const cnt = totals.events?.[ev] || 0;
          const cvr = totals.sessions > 0 ? ((cnt / totals.sessions) * 100).toFixed(2) : '0.00';
          const col = EVENT_COLORS[i % EVENT_COLORS.length];
          return (
            <div key={ev} style={{ flex: '1', minWidth: '120px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: `3px solid ${col}` }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventLabel(ev)}</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: col }}>{loading ? '—' : cnt.toLocaleString() + '件'}</div>
              <div style={{ fontSize: '12px', color: col, opacity: 0.8 }}>CVR {loading ? '—' : cvr + '%'}</div>
            </div>
          );
        })}
      </div>

      {/* テーブル */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
        {/* タブ */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee', overflowX: 'auto' }}>
          <button onClick={() => { setActiveView('all'); setFilterText(''); setSortKey('sessions'); setSortDesc(true); }}
            style={{ padding: '12px 20px', fontSize: '13px', fontWeight: activeView === 'all' ? 'bold' : 'normal', color: activeView === 'all' ? '#1a8fc1' : '#555', backgroundColor: 'transparent', border: 'none', borderBottom: activeView === 'all' ? '3px solid #1a8fc1' : '3px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            すべて
          </button>
          {PARAM_TYPES.map(pt => (
            <button key={pt.key} onClick={() => { setActiveView(pt.key); setFilterText(''); setSortKey('sessions'); setSortDesc(true); }}
              style={{ padding: '12px 20px', fontSize: '13px', fontWeight: activeView === pt.key ? 'bold' : 'normal', color: activeView === pt.key ? '#1a8fc1' : '#555', backgroundColor: 'transparent', border: 'none', borderBottom: activeView === pt.key ? '3px solid #1a8fc1' : '3px solid transparent', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {pt.label} <span style={{ fontSize: '11px', color: '#999' }}>({pt.desc})</span>
            </button>
          ))}
        </div>

        {/* サマリーバー */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: '20px', fontSize: '13px', color: '#555', backgroundColor: '#fafafa', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
          <span>セッション合計: <strong style={{ color: '#1a8fc1' }}>{loading ? '—' : totals.sessions.toLocaleString()}</strong></span>
          {selectedEvents.map((ev, i) => {
            const total = totals.events?.[ev] || 0;
            const rate = totals.sessions > 0 ? ((total / totals.sessions) * 100).toFixed(1) : '0.0';
            return <span key={ev} style={{ color: EVENT_COLORS[i % EVENT_COLORS.length] }}>{getEventLabel(ev)}: <strong>{total.toLocaleString()}件</strong> ({rate}%)</span>;
          })}
          <span style={{ marginLeft: 'auto', color: '#888' }}>{filtered.length} 件</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {activeView === 'all' ? (
                  <>
                    <th style={{ ...thBase, textAlign: 'left' }} onClick={() => handleSort('source')}>ソース <SortIcon col="source" /></th>
                    <th style={{ ...thBase, textAlign: 'left' }} onClick={() => handleSort('medium')}>メディア <SortIcon col="medium" /></th>
                    <th style={{ ...thBase, textAlign: 'left' }} onClick={() => handleSort('campaign')}>キャンペーン <SortIcon col="campaign" /></th>
                    {showDetails && <th style={{ ...thBase, textAlign: 'left', backgroundColor: '#f0faf5' }} onClick={() => handleSort('term')}>用語 <SortIcon col="term" /></th>}
                    {showDetails && <th style={{ ...thBase, textAlign: 'left', backgroundColor: '#f0faf5' }} onClick={() => handleSort('content')}>コンテンツ <SortIcon col="content" /></th>}
                    <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('sessions')}>セッション <SortIcon col="sessions" /></th>
                    <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('bounceRate')}>直帰率 <SortIcon col="bounceRate" /></th>
                  </>
                ) : (
                  <>
                    <th style={{ ...thBase, textAlign: 'left' }}>{PARAM_TYPES.find(p => p.key === activeView)?.label}</th>
                    <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('sessions')}>セッション数 <SortIcon col="sessions" /></th>
                    <th style={{ ...thBase, textAlign: 'right' }} onClick={() => handleSort('bounceRate')}>直帰率 <SortIcon col="bounceRate" /></th>
                    <th style={{ ...thBase, textAlign: 'right' }}>構成比</th>
                  </>
                )}
                {selectedEvents.map((ev, i) => (
                  <th key={ev} style={{ ...thBase, textAlign: 'right', backgroundColor: '#fef9e7', borderBottom: '2px solid #f9ca24', cursor: 'pointer' }} onClick={() => handleSort(ev)}>
                    <div style={{ fontSize: '11px', color: EVENT_COLORS[i % EVENT_COLORS.length] }}>{getEventLabel(ev)}</div>
                    {activeView === 'all' && <div style={{ fontSize: '9px', color: '#bbb', fontFamily: 'monospace', fontWeight: 'normal' }}>{ev}</div>}
                    <SortIcon col={ev} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: activeView === 'all' ? (showDetails ? 7 : 5) + selectedEvents.length : 4 + selectedEvents.length }).map((_, j) => (
                  <td key={j} style={{ padding: '10px 10px' }}><div style={{ height: '13px', backgroundColor: '#f0f0f0', borderRadius: '3px', width: j < 3 ? '75%' : '50%' }} /></td>
                ))}</tr>
              )) : sorted.length === 0 ? (
                <tr><td colSpan={activeView === 'all' ? (showDetails ? 7 : 5) + selectedEvents.length : 4 + selectedEvents.length} style={{ textAlign: 'center', padding: '32px', color: '#888', fontSize: '13px' }}>データがありません</td></tr>
              ) : activeView === 'all' ? sorted.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e8f4fb'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = i % 2 === 1 ? '#fafafa' : 'white'}>
                  <td style={{ padding: '8px 10px', fontSize: '12px' }}>
                    <span style={{ display: 'inline-block', padding: '2px 7px', borderRadius: '3px', backgroundColor: '#e8f4fb', color: '#1a8fc1', fontSize: '12px', fontWeight: 'bold' }}>
                      {row.source === '(direct)' || row.source === 'direct' ? '直接' : row.source}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: '12px', color: '#555' }}>{row.medium === '(none)' ? '—' : row.medium}</td>
                  <td style={{ padding: '8px 10px', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#555' }}>
                    {row.campaign === '(not set)' || row.campaign === 'not set' ? '—' : row.campaign}
                  </td>
                  {showDetails && <td style={{ padding: '8px 10px', fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2d8a5e', backgroundColor: '#f9fffb' }}>
                    {!row.term || row.term === '(not set)' ? <span style={{ color: '#ccc' }}>—</span> : row.term}
                  </td>}
                  {showDetails && <td style={{ padding: '8px 10px', fontSize: '12px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#2d8a5e', backgroundColor: '#f9fffb' }}>
                    {!row.content || row.content === '(not set)' ? <span style={{ color: '#ccc' }}>—</span> : row.content}
                  </td>}
                  <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right' }}>{row.sessions.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right', color: parseFloat(row.bounceRate) > 70 ? '#e53935' : '#333' }}>{row.bounceRate}%</td>
                  {selectedEvents.map((ev, j) => {
                    const cnt = row.events?.[ev] ?? 0;
                    const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                    const col = EVENT_COLORS[j % EVENT_COLORS.length];
                    return (
                      <td key={ev} style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: '#fffef5' }}>
                        <div style={{ fontSize: '13px', fontWeight: cnt > 0 ? 'bold' : 'normal', color: cnt > 0 ? col : '#ccc' }}>{cnt > 0 ? cnt.toLocaleString() + '件' : '—'}</div>
                        {cnt > 0 && <div style={{ fontSize: '11px', color: col, opacity: 0.8 }}>{cvr}%</div>}
                      </td>
                    );
                  })}
                </tr>
              )) : sorted.map((row, i) => {
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
                      const cnt = row.events?.[ev] ?? 0;
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
            {!loading && sorted.length > 0 && activeView === 'all' && (
              <tfoot>
                <tr style={{ backgroundColor: '#f5f7fa', fontWeight: 'bold' }}>
                  <td colSpan={showDetails ? 5 : 3} style={{ padding: '8px 10px', fontSize: '13px', color: '#555' }}>合計</td>
                  <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right' }}>{totals.sessions.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', fontSize: '13px', textAlign: 'right' }}>—</td>
                  {selectedEvents.map((ev, j) => {
                    const cnt = totals.events?.[ev] || 0;
                    const cvr = totals.sessions > 0 ? ((cnt / totals.sessions) * 100).toFixed(1) : '0.0';
                    const col = EVENT_COLORS[j % EVENT_COLORS.length];
                    return (
                      <td key={ev} style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: '#fffef5' }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: col }}>{cnt.toLocaleString()}件</div>
                        <div style={{ fontSize: '11px', color: col, opacity: 0.8 }}>{cvr}%</div>
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </Layout>
  );
}
