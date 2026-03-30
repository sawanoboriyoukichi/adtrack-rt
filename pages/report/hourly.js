import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';
import MicroConversionSelector, { getEventLabel } from '../../components/MicroConversionSelector';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const EVENT_COLORS = ['#e67e22', '#9b59b6', '#e74c3c', '#1abc9c', '#3498db', '#f39c12', '#2ecc71', '#e91e63'];

function getHeatColor(value, max) {
  if (!max || max === 0 || value === 0) return '#f0f4f8';
  const ratio = value / max;
  if (ratio < 0.2) return '#c8e6f5';
  if (ratio < 0.4) return '#7ec8e8';
  if (ratio < 0.6) return '#2aa5d8';
  if (ratio < 0.8) return '#1a8fc1';
  return '#0d5f8a';
}

function exportToCSV(rows, selectedEvents, filename, totalSessions) {
  const headers = ['時間帯', 'セッション数', '構成比(%)', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', getEventLabel(e) + '(率%)'])];
  const csvRows = rows.map(row => {
    const share = totalSessions > 0 ? (row.sessions / totalSessions * 100).toFixed(1) : '0.0';
    const base = [row.hour, row.sessions, share];
    const evCols = selectedEvents.flatMap(e => {
      const cnt = row[e] ?? 0;
      const rate = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
      return [cnt, rate];
    });
    return [...base, ...evCols].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const csv = [headers.map(h => `"${h}"`).join(','), ...csvRows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

export default function HourlyReport() {
  const [startDate, setStartDate] = useState('28daysAgo');
  const [endDate, setEndDate] = useState('today');
  const [siteId, setSiteId] = useState('default');
  const [filterSource, setFilterSource] = useState('');
  const [filterMedium, setFilterMedium] = useState('');
  const [appliedSource, setAppliedSource] = useState('');
  const [appliedMedium, setAppliedMedium] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSite = localStorage.getItem('adtrack_site_id');
      if (savedSite) setSiteId(savedSite);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = `startDate=${startDate}&endDate=${endDate}&site_id=${siteId}&filterSource=${encodeURIComponent(appliedSource)}&filterMedium=${encodeURIComponent(appliedMedium)}`;
      const [hourlyRes, evNamesRes, evByHourRes] = await Promise.all([
        fetch(`/api/report?type=hourly&${params}`),
        fetch(`/api/report?type=eventnames&${params}`),
        fetch(`/api/report?type=eventsbyhour&${params}`),
      ]);
      const hourlyData = await hourlyRes.json();
      const evNames = await evNamesRes.json();
      const evByHour = await evByHourRes.json();
      setAvailableEvents(evNames);

      const merged = HOURS.map(h => {
        const hStr = String(h).padStart(2, '0');
        const hourRow = hourlyData.find(d => d.hour === h) || {};
        const row = { hour: `${hStr}:00`, hourNum: h, sessions: hourRow.sessions || 0 };
        evByHour.filter(e => e.hour === h).forEach(e => { row[e.eventName] = (row[e.eventName] || 0) + e.count; });
        return row;
      });
      setData(merged);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [startDate, endDate, siteId, appliedSource, appliedMedium]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const applyFilter = () => { setAppliedSource(filterSource); setAppliedMedium(filterMedium); };
  const clearFilter = () => { setFilterSource(''); setFilterMedium(''); setAppliedSource(''); setAppliedMedium(''); };

  const maxSessions = Math.max(...data.map(d => d.sessions), 1);
  const totalSessions = data.reduce((s, r) => s + r.sessions, 0);
  const peakRow = data.reduce((a, b) => a.sessions >= b.sessions ? a : b, data[0] || { hour: '—', sessions: 0 });
  const eventTotals = selectedEvents.reduce((acc, ev) => ({ ...acc, [ev]: data.reduce((s, r) => s + (r[ev] || 0), 0) }), {});

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ backgroundColor: 'white', border: '1px solid #ddd', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>{label}</div>
        {payload.map(p => <div key={p.dataKey} style={{ color: p.color || '#1a8fc1', marginBottom: '2px' }}>{p.name}: <strong>{p.value?.toLocaleString()}</strong></div>)}
      </div>
    );
  };

  return (
    <Layout title="時間別レポート">
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '14px 18px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} loading={loading} onRefresh={fetchData} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <MicroConversionSelector events={availableEvents} selected={selectedEvents} onChange={setSelectedEvents} />
            <button onClick={() => exportToCSV(data, selectedEvents, `hourly_${startDate}_${endDate}.csv`, totalSessions)}
              disabled={data.length === 0}
              style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #27ae60', backgroundColor: '#27ae60', color: 'white', cursor: data.length === 0 ? 'default' : 'pointer', opacity: data.length === 0 ? 0.5 : 1 }}>
              📥 CSV
            </button>
          </div>
        </div>
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>絞り込み：</span>
          <input type="text" placeholder="ソース（例: t.co）" value={filterSource} onChange={e => setFilterSource(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '150px' }} />
          <input type="text" placeholder="メディア（例: social）" value={filterMedium} onChange={e => setFilterMedium(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyFilter()}
            style={{ padding: '4px 10px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', width: '150px' }} />
          <button onClick={applyFilter} style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: '#1a8fc1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>適用</button>
          {(appliedSource || appliedMedium) && <>
            <button onClick={clearFilter} style={{ padding: '4px 10px', fontSize: '12px', backgroundColor: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>クリア</button>
            <span style={{ fontSize: '11px', color: '#e67e22', fontWeight: 'bold' }}>🔍 {[appliedSource, appliedMedium].filter(Boolean).join(' / ')} でフィルター中</span>
          </>}
        </div>
      </div>

      {error && <div style={{ backgroundColor: '#fff0f0', border: '1px solid #ffcdd2', borderRadius: '6px', padding: '12px 16px', color: '#c62828', fontSize: '13px', marginBottom: '16px' }}>エラー: {error}</div>}

      {/* サマリーカード */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[
          { label: '総セッション数', value: totalSessions.toLocaleString(), color: '#1a8fc1', sub: null },
          { label: 'ピーク時間', value: loading ? '—' : peakRow.hour, color: '#e87c3e', sub: loading ? null : peakRow.sessions.toLocaleString() + '件' },
        ].map(card => (
          <div key={card.label} style={{ flex: '1', minWidth: '110px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: `3px solid ${card.color}` }}>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: card.color }}>{loading ? '—' : card.value}</div>
            {card.sub && <div style={{ fontSize: '11px', color: '#888' }}>{card.sub}</div>}
          </div>
        ))}
        {selectedEvents.map((ev, i) => {
          const cnt = eventTotals[ev] || 0;
          const rate = totalSessions > 0 ? ((cnt / totalSessions) * 100).toFixed(1) : '0.0';
          const col = EVENT_COLORS[i % EVENT_COLORS.length];
          return (
            <div key={ev} style={{ flex: '1', minWidth: '120px', backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px 16px', borderTop: `3px solid ${col}` }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventLabel(ev)}</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: col }}>{loading ? '—' : cnt.toLocaleString() + '件'}</div>
              <div style={{ fontSize: '11px', color: col, opacity: 0.8 }}>達成率 {loading ? '—' : rate + '%'}</div>
            </div>
          );
        })}
      </div>

      {/* バーチャート */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#333', marginBottom: '16px' }}>時間帯別セッション数</div>
        {loading ? (
          <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '13px' }}>データ取得中...</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={v => v.replace(':00', '')} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sessions" name="セッション数" radius={[3, 3, 0, 0]}>
                {data.map((entry, i) => <Cell key={i} fill={getHeatColor(entry.sessions, maxSessions)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '10px', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: '#888' }}>少</span>
          {['#f0f4f8', '#c8e6f5', '#7ec8e8', '#2aa5d8', '#1a8fc1', '#0d5f8a'].map(c => (
            <div key={c} style={{ width: '20px', height: '10px', backgroundColor: c, borderRadius: '2px' }} />
          ))}
          <span style={{ fontSize: '11px', color: '#888' }}>多</span>
        </div>
      </div>

      {/* 時間別テーブル */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden' }}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '14px', color: '#333' }}>時間帯別データ一覧</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f7fa' }}>
                {['時間帯', 'セッション数', '構成比', ...selectedEvents.flatMap(e => [getEventLabel(e) + '(件)', '達成率%'])].map((h, i) => (
                  <th key={i} style={{ padding: '9px 10px', fontSize: '12px', fontWeight: 'bold', color: '#555', textAlign: i === 0 ? 'left' : 'right', borderBottom: '2px solid #ddd', backgroundColor: i >= 3 ? '#fef9e7' : '#f5f7fa' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 3 + selectedEvents.length * 2 }).map((_, j) => (
                  <td key={j} style={{ padding: '9px 10px' }}><div style={{ height: '13px', backgroundColor: '#f0f0f0', borderRadius: '3px' }} /></td>
                ))}</tr>
              )) : data.map((row, i) => {
                const share = totalSessions > 0 ? (row.sessions / totalSessions * 100).toFixed(1) : '0.0';
                const isPeak = row.sessions === maxSessions && maxSessions > 0;
                return (
                  <tr key={i} style={{ backgroundColor: isPeak ? '#e8f4fb' : i % 2 === 1 ? '#fafafa' : 'white' }}>
                    <td style={{ padding: '9px 10px', fontSize: '13px', fontWeight: isPeak ? 'bold' : 'normal', color: isPeak ? '#1a8fc1' : '#333' }}>
                      {row.hour} {isPeak && '⭐'}
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: '13px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <div style={{ height: '8px', width: `${Math.round((row.sessions / maxSessions) * 50)}px`, backgroundColor: getHeatColor(row.sessions, maxSessions), borderRadius: '2px', minWidth: row.sessions > 0 ? '3px' : '0' }} />
                        {row.sessions.toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: '12px', textAlign: 'right', color: '#888' }}>{share}%</td>
                    {selectedEvents.map((ev, j) => {
                      const cnt = row[ev] ?? 0;
                      const rate = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                      const col = EVENT_COLORS[j % EVENT_COLORS.length];
                      return [
                        <td key={ev + '_cnt'} style={{ padding: '9px 10px', fontSize: '13px', textAlign: 'right', backgroundColor: '#fffef5', color: cnt > 0 ? col : '#ccc', fontWeight: cnt > 0 ? 'bold' : 'normal' }}>
                          {cnt > 0 ? cnt.toLocaleString() + '件' : '—'}
                        </td>,
                        <td key={ev + '_rate'} style={{ padding: '9px 10px', fontSize: '12px', textAlign: 'right', backgroundColor: '#fffef5', color: cnt > 0 ? col : '#ccc' }}>
                          {cnt > 0 ? rate + '%' : '—'}
                        </td>,
                      ];
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
