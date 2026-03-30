import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';
import MicroConversionSelector, { getEventLabel } from '../../components/MicroConversionSelector';

const DEFAULT_SELECTED = ['email_registration', 'line_registration'];
const EVENT_COLORS = ['#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db', '#f39c12', '#2ecc71', '#e91e63'];
const SELECTED_STORAGE_KEY = 'adtrack_selected_cv';

function exportToCSV(rows, selectedEvents, filename) {
  const headers = ['日付', 'セッション数', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', getEventLabel(e) + '(CVR%)'])];
  const csvRows = rows.map(row => {
    const base = [row.date, row.sessions];
    const evCols = selectedEvents.flatMap(e => {
      const cnt = row[e] ?? 0;
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

export default function PeriodReport() {
  const [startDate, setStartDate] = useState('28daysAgo');
  const [endDate, setEndDate] = useState('today');
  const [siteId, setSiteId] = useState('default');
  const [filterSource, setFilterSource] = useState('');
  const [filterMedium, setFilterMedium] = useState('');
  const [appliedSource, setAppliedSource] = useState('');
  const [appliedMedium, setAppliedMedium] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState(DEFAULT_SELECTED);
  const [error, setError] = useState(null);

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
      const params = `startDate=${startDate}&endDate=${endDate}&site_id=${siteId}&filterSource=${encodeURIComponent(appliedSource)}&filterMedium=${encodeURIComponent(appliedMedium)}`;
      const [sessRes, evNamesRes, evByDateRes] = await Promise.all([
        fetch(`/api/report?type=sessions&${params}`),
        fetch(`/api/report?type=eventnames&${params}`),
        fetch(`/api/report?type=eventsbydate&${params}`),
      ]);
      const sessData = await sessRes.json();
      const evNames = await evNamesRes.json();
      const evByDate = await evByDateRes.json();
      setAvailableEvents(evNames);
      const merged = sessData.map(s => {
        const row = { ...s, label: s.date.slice(5) };
        evByDate.filter(e => e.date === s.date).forEach(e => { row[e.eventName] = (row[e.eventName] || 0) + e.count; });
        return row;
      });
      setSessions(merged);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, siteId, appliedSource, appliedMedium]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilter = () => { setAppliedSource(filterSource); setAppliedMedium(filterMedium); };
  const clearFilter = () => { setFilterSource(''); setFilterMedium(''); setAppliedSource(''); setAppliedMedium(''); };

  const totalSessions = sessions.reduce((s, r) => s + r.sessions, 0);
  const eventTotals = selectedEvents.reduce((acc, ev) => ({ ...acc, [ev]: sessions.reduce((s, r) => s + (r[ev] || 0), 0) }), {});

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '10px 14px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#333' }}>{label}</div>
        {payload.map(p => <div key={p.dataKey} style={{ color: p.color, marginBottom: '2px' }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>)}
      </div>
    );
  };

  return (
    <Layout title="期間別レポート">
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} loading={loading} onRefresh={fetchData} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MicroConversionSelector events={availableEvents} selected={selectedEvents} onChange={handleSelectedEventsChange} />
            <button onClick={() => exportToCSV([...sessions].reverse(), selectedEvents, `period_${startDate}_${endDate}.csv`)}
              disabled={sessions.length === 0}
              style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: 'white', cursor: sessions.length === 0 ? 'default' : 'pointer', opacity: sessions.length === 0 ? 0.5 : 1 }}>
              📥 CSV
            </button>
          </div>
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>絞り込み：</span>
          <input type="text" placeholder="ソース（例: t.co）" value={filterSource} onChange={e => setFilterSource(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }} />
          <input type="text" placeholder="メディア（例: social）" value={filterMedium} onChange={e => setFilterMedium(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '160px' }} />
          <button onClick={applyFilter} style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#1a8fc1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>適用</button>
          {(appliedSource || appliedMedium) && <button onClick={clearFilter} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>クリア</button>}
          {(appliedSource || appliedMedium) && <span style={{ fontSize: '11px', color: '#e67e22', fontWeight: 'bold' }}>🔍 {[appliedSource, appliedMedium].filter(Boolean).join(' / ')} でフィルター中</span>}
        </div>
      </div>

      {error && <div style={{ backgroundColor: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '6px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' }}>エラー: {error}</div>}

      {/* サマリーカード */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1', minWidth: '110px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: '3px solid #1a8fc1' }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>セッション数</div>
          <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1a8fc1' }}>{loading ? '—' : totalSessions.toLocaleString()}</div>
        </div>
        {selectedEvents.map((ev, i) => {
          const cnt = eventTotals[ev] || 0;
          const cvr = totalSessions > 0 ? ((cnt / totalSessions) * 100).toFixed(2) : '0.00';
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

      {/* セッション推移チャート */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>セッション数の推移</div>
        {loading ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '13px' }}>データ取得中...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={sessions} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a8fc1" stopOpacity={0.2} /><stop offset="95%" stopColor="#1a8fc1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sessions" name="セッション数" stroke="#1a8fc1" strokeWidth={2} fill="url(#sessGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* マイクロCV推移チャート */}
      {selectedEvents.length > 0 && (
        <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>マイクロコンバージョン推移</div>
          {loading ? (
            <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '13px' }}>データ取得中...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sessions} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                {selectedEvents.map((ev, i) => (
                  <Bar key={ev} dataKey={ev} name={getEventLabel(ev)} fill={EVENT_COLORS[i % EVENT_COLORS.length]} stackId="ev"
                    radius={i === selectedEvents.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* 日別テーブル */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>日別データ</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f7fa' }}>
                {['日付', 'セッション数', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', 'CVR%'])].map((h, i) => (
                  <th key={i} style={{ padding: '9px 10px', fontSize: '12px', fontWeight: 'bold', color: '#555', textAlign: i === 0 ? 'left' : 'right', borderBottom: '2px solid #ddd', backgroundColor: i >= 2 ? '#fef9e7' : '#f5f7fa' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 7 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 2 + selectedEvents.length * 2 }).map((_, j) => (
                  <td key={j} style={{ padding: '9px 10px' }}><div style={{ height: '13px', backgroundColor: '#f0f0f0', borderRadius: '3px' }} /></td>
                ))}</tr>
              )) : [...sessions].reverse().map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#fafafa' : 'white' }}>
                  <td style={{ padding: '9px 10px', fontSize: '13px', color: '#333' }}>{row.date}</td>
                  <td style={{ padding: '9px 10px', fontSize: '13px', textAlign: 'right' }}>{row.sessions.toLocaleString()}</td>
                  {selectedEvents.map((ev, j) => {
                    const cnt = row[ev] ?? 0;
                    const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                    const col = EVENT_COLORS[j % EVENT_COLORS.length];
                    return [
                      <td key={ev + '_cnt'} style={{ padding: '9px 10px', fontSize: '13px', textAlign: 'right', backgroundColor: '#fffef5', color: cnt > 0 ? col : '#ccc', fontWeight: cnt > 0 ? 'bold' : 'normal' }}>
                        {cnt > 0 ? cnt.toLocaleString() + '件' : '—'}
                      </td>,
                      <td key={ev + '_cvr'} style={{ padding: '9px 10px', fontSize: '12px', textAlign: 'right', backgroundColor: '#fffef5', color: cnt > 0 ? col : '#ccc' }}>
                        {cnt > 0 ? cvr + '%' : '—'}
                      </td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}
