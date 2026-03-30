import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';

const CV_COLORS = ['#e8771e', '#c75393', '#2196f3', '#4caf50', '#9c27b0', '#ff5722'];

function getPresetDates(preset) {
  const now = new Date();
  const fmt = (d) => d.toISOString().substring(0, 10);
  const today = fmt(now);
  switch (preset) {
    case '今日': return { from: today, to: today };
    case '昨日': return { from: fmt(new Date(now - 86400000)), to: fmt(new Date(now - 86400000)) };
    case '直近7日': return { from: fmt(new Date(now - 6 * 86400000)), to: today };
    case '直近14日': return { from: fmt(new Date(now - 13 * 86400000)), to: today };
    case '直近28日': return { from: fmt(new Date(now - 27 * 86400000)), to: today };
    case '直近90日': return { from: fmt(new Date(now - 89 * 86400000)), to: today };
    default: return { from: fmt(new Date(now - 27 * 86400000)), to: today };
  }
}

const PRESETS = ['今日', '昨日', '直近7日', '直近14日', '直近28日', '直近90日'];
const DIMENSIONS = [
  { key: 'source', label: 'ソース (utm_source)' },
  { key: 'medium', label: 'メディア (utm_medium)' },
  { key: 'campaign', label: 'キャンペーン (utm_campaign)' },
  { key: 'term', label: 'キャンペーン用語 (utm_term)' },
  { key: 'content', label: 'コンテンツ (utm_content)' },
];

export default function ParamsReport() {
  const [mounted, setMounted] = useState(false);
  const [siteId, setSiteId] = useState('default');
  const [preset, setPreset] = useState('直近28日');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dimension, setDimension] = useState('source');
  const [search, setSearch] = useState('');

  const [allEventNames, setAllEventNames] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [showCvDropdown, setShowCvDropdown] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [sortKey, setSortKey] = useState('sessions');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('adtrack_site_id') : null;
    const sid = saved || 'default';
    setSiteId(sid);

    const dates = getPresetDates('直近28日');
    setFrom(dates.from); setTo(dates.to);
    setCustomFrom(dates.from); setCustomTo(dates.to);

    const savedEvents = typeof window !== 'undefined' ? localStorage.getItem('adtrack_selected_events') : null;
    fetch(`/api/report?type=event_names&site_id=${sid}`)
      .then(r => r.json())
      .then(d => {
        const names = d.event_names || [];
        setAllEventNames(names);
        if (savedEvents) {
          const parsed = JSON.parse(savedEvents);
          setSelectedEvents(parsed.filter(e => names.includes(e)));
        } else {
          setSelectedEvents(names.slice(0, 3));
        }
      }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true); setError('');
    try {
      const evParam = selectedEvents.join(',');
      const url = `/api/report?type=params&site_id=${siteId}&from=${from}&to=${to}&events=${encodeURIComponent(evParam)}&dimension=${dimension}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('データ取得に失敗しました');
    } finally { setLoading(false); }
  }, [siteId, from, to, selectedEvents, dimension, search]);

  useEffect(() => {
    if (mounted && from && to) fetchData();
  }, [mounted, from, to, selectedEvents, dimension]);

  const handlePreset = (p) => {
    setPreset(p);
    const dates = getPresetDates(p);
    setFrom(dates.from); setTo(dates.to);
    setCustomFrom(dates.from); setCustomTo(dates.to);
  };

  const toggleEvent = (evName) => {
    const next = selectedEvents.includes(evName)
      ? selectedEvents.filter(e => e !== evName)
      : [...selectedEvents, evName];
    setSelectedEvents(next);
    if (typeof window !== 'undefined') localStorage.setItem('adtrack_selected_events', JSON.stringify(next));
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const getSortedRows = () => {
    if (!data?.rows) return [];
    return [...data.rows].sort((a, b) => {
      let av, bv;
      if (sortKey === 'sessions') { av = a.sessions; bv = b.sessions; }
      else if (sortKey === 'bounceRate') { av = parseFloat(a.bounceRate); bv = parseFloat(b.bounceRate); }
      else if (sortKey === 'pct') { av = parseFloat(a.pct); bv = parseFloat(b.pct); }
      else if (sortKey.startsWith('cv_')) {
        const ev = sortKey.slice(3);
        av = a.cv?.[ev] || 0; bv = b.cv?.[ev] || 0;
      } else { av = a.sessions; bv = b.sessions; }
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  };

  const maxSessions = data?.rows ? Math.max(...data.rows.map(r => r.sessions), 1) : 1;

  const handleCsv = () => {
    if (!data?.rows) return;
    const dimLabel = DIMENSIONS.find(d => d.key === dimension)?.label || dimension;
    const headers = [dimLabel, 'セッション数', '直帰率', '構成比', ...selectedEvents.flatMap(ev => [ev + '(件)', ev + '(CVR%)'])];
    const rows = getSortedRows().map(r => [
      r.value, r.sessions, r.bounceRate + '%', r.pct + '%',
      ...selectedEvents.flatMap(ev => [r.cv?.[ev] || 0, r.sessions > 0 ? ((r.cv?.[ev] || 0) / r.sessions * 100).toFixed(1) + '%' : '—']),
    ]);
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `params_${dimension}_${from}_${to}.csv`;
    a.click();
  };

  const s = {
    card: { background: 'white', borderRadius: 8, padding: '20px 24px', marginBottom: 16 },
    btn: { padding: '5px 12px', borderRadius: 4, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13 },
    btnActive: { padding: '5px 12px', borderRadius: 4, border: 'none', background: '#1a8fc1', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: '600' },
    th: { padding: '10px 12px', fontSize: 12, color: '#666', fontWeight: '600', textAlign: 'left', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' },
    td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f0f4f8' },
  };

  const sortedRows = getSortedRows();

  if (!mounted) return null;

  return (
    <Layout>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#2d3748' }}>パラメーター別レポート</h2>

      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555', marginRight: 4 }}>期間：</span>
          {PRESETS.map(p => (
            <button key={p} onClick={() => handlePreset(p)} style={preset === p ? s.btnActive : s.btn}>{p}</button>
          ))}
          <button onClick={fetchData} style={{ ...s.btn, background: '#2aa5d8', color: 'white', border: 'none', marginLeft: 4 }}>更新</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555' }}>カスタム：</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }} />
          <span>〜</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }} />
          <button onClick={() => { setPreset(''); setFrom(customFrom); setTo(customTo); }}
            style={{ ...s.btn, background: '#e8771e', color: 'white', border: 'none' }}>適用</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="値で絞り込み..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
            style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, width: 200 }}
          />
          {/* CV選択 */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowCvDropdown(v => !v)}
              style={{ ...s.btn, background: '#1a8fc1', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              📊 マイクロCV選択 {selectedEvents.length > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{selectedEvents.length}</span>} ▼
            </button>
            {showCvDropdown && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'white', border: '1px solid #ccc', borderRadius: 6, padding: 8, minWidth: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                {allEventNames.map(ev => (
                  <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={() => toggleEvent(ev)} />
                    <span style={{ fontSize: 13 }}>{ev}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedEvents.map((ev, i) => (
            <span key={ev} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, background: `${CV_COLORS[i % CV_COLORS.length]}22`, border: `1px solid ${CV_COLORS[i % CV_COLORS.length]}`, color: CV_COLORS[i % CV_COLORS.length], borderRadius: 12, padding: '2px 8px' }}>
              {ev} <span onClick={() => toggleEvent(ev)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
            </span>
          ))}
          <button onClick={handleCsv} style={{ ...s.btn, background: '#27ae60', color: 'white', border: 'none', marginLeft: 'auto' }}>📥 CSV</button>
        </div>
      </div>

      {/* ディメンションタブ */}
      <div style={{ background: 'white', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e2e8f0', padding: '0 16px', display: 'flex', overflowX: 'auto' }}>
        {DIMENSIONS.map(d => (
          <button
            key={d.key}
            onClick={() => { setDimension(d.key); setPage && setPage(1); }}
            style={{
              padding: '11px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: 'none',
              borderBottom: dimension === d.key ? '2px solid #1a8fc1' : '2px solid transparent',
              color: dimension === d.key ? '#1a8fc1' : '#555',
              fontWeight: dimension === d.key ? '600' : 'normal',
              whiteSpace: 'nowrap',
            }}
          >{d.label}</button>
        ))}
      </div>

      {/* テーブル */}
      <div style={{ background: 'white', borderRadius: '0 0 8px 8px', overflow: 'hidden', marginBottom: 16 }}>
        {/* サマリー行 */}
        {data && (
          <div style={{ padding: '10px 16px', fontSize: 13, color: '#555', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>セッション合計: <strong>{data.totalSessions}</strong></span>
            {selectedEvents.map((ev, i) => (
              <span key={ev} style={{ color: CV_COLORS[i % CV_COLORS.length] }}>
                {ev}: <strong>{data.totalCv?.[ev] || 0}件</strong> ({data.totalSessions > 0 ? (((data.totalCv?.[ev] || 0) / data.totalSessions) * 100).toFixed(1) : '0.0'}%)
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: '#888' }}>{sortedRows.length} 件</span>
          </div>
        )}

        {loading && <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>読み込み中...</div>}
        {error && <div style={{ padding: 16, color: 'red' }}>{error}</div>}

        {!loading && data && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  <th style={s.th} onClick={() => handleSort('value')}>
                    {DIMENSIONS.find(d => d.key === dimension)?.label?.split(' ')[0] || 'ソース'}
                    {sortKey === 'value' ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
                  </th>
                  <th style={{ ...s.th, textAlign: 'right', width: '35%' }} onClick={() => handleSort('sessions')}>
                    セッション数 {sortKey === 'sessions' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th style={{ ...s.th, textAlign: 'right' }} onClick={() => handleSort('bounceRate')}>
                    直帰率 {sortKey === 'bounceRate' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  <th style={{ ...s.th, textAlign: 'right' }} onClick={() => handleSort('pct')}>
                    構成比 {sortKey === 'pct' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                  </th>
                  {selectedEvents.map((ev, i) => (
                    <th key={ev} style={{ ...s.th, textAlign: 'right', color: CV_COLORS[i % CV_COLORS.length], borderLeft: `2px solid ${CV_COLORS[i % CV_COLORS.length]}33` }}
                      onClick={() => handleSort(`cv_${ev}`)}>
                      {ev} {sortKey === `cv_${ev}` ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => {
                  const barPct = (row.sessions / maxSessions) * 100;
                  return (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={s.td}>
                        <span style={{ color: '#1a8fc1', fontWeight: '500' }}>{row.value}</span>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ width: 60, height: 6, background: '#edf2f7', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${barPct}%`, height: '100%', background: '#2aa5d8', borderRadius: 3 }} />
                          </div>
                          <span style={{ fontWeight: '600', minWidth: 30 }}>{row.sessions}</span>
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: parseFloat(row.bounceRate) > 70 ? '#e74c3c' : '#555' }}>
                        {row.bounceRate}%
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#666' }}>{row.pct}%</td>
                      {selectedEvents.map((ev, i) => {
                        const cnt = row.cv?.[ev] || 0;
                        const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                        return (
                          <td key={ev} style={{ ...s.td, textAlign: 'right', borderLeft: `2px solid ${CV_COLORS[i % CV_COLORS.length]}33` }}>
                            {cnt > 0 ? (
                              <>
                                <div style={{ color: CV_COLORS[i % CV_COLORS.length], fontWeight: '600' }}>{cnt}件</div>
                                <div style={{ fontSize: 11, color: CV_COLORS[i % CV_COLORS.length] }}>{cvr}%</div>
                              </>
                            ) : <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {sortedRows.length === 0 && (
                  <tr><td colSpan={4 + selectedEvents.length} style={{ padding: 32, textAlign: 'center', color: '#999' }}>データなし</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
