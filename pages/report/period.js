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

// SVG折れ線グラフ
function LineChart({ data, width = 800, height = 200 }) {
  if (!data || data.length === 0) return null;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const W = width - padding.left - padding.right;
  const H = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.sessions), 1);
  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1 || 1)) * W,
    y: padding.top + H - (d.sessions / maxVal) * H,
    label: d.date?.substring(5),
    val: d.sessions,
  }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');
  const area = [
    `${points[0].x},${padding.top + H}`,
    ...points.map(p => `${p.x},${p.y}`),
    `${points[points.length - 1].x},${padding.top + H}`,
  ].join(' ');

  // 間引き（ラベル重複防止）
  const labelStep = Math.ceil(data.length / 10);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* グリッド */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={padding.left} y1={padding.top + H * (1 - f)} x2={padding.left + W} y2={padding.top + H * (1 - f)}
            stroke="#e2e8f0" strokeWidth={1} />
          <text x={padding.left - 4} y={padding.top + H * (1 - f) + 4} textAnchor="end" fontSize={10} fill="#999">
            {Math.round(maxVal * f)}
          </text>
        </g>
      ))}
      {/* エリア */}
      <polygon points={area} fill="#2aa5d8" opacity={0.1} />
      {/* 折れ線 */}
      <polyline points={polyline} fill="none" stroke="#2aa5d8" strokeWidth={2} />
      {/* ポイント */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#2aa5d8" />
      ))}
      {/* X軸ラベル */}
      {points.map((p, i) => i % labelStep === 0 && (
        <text key={i} x={p.x} y={padding.top + H + 20} textAnchor="middle" fontSize={10} fill="#888">{p.label}</text>
      ))}
    </svg>
  );
}

// SVG棒グラフ（CV推移）
function BarChart({ data, events, colors, width = 800, height = 200 }) {
  if (!data || data.length === 0 || events.length === 0) return null;
  const padding = { top: 20, right: 20, bottom: 60, left: 40 };
  const W = width - padding.left - padding.right;
  const H = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data.map(d => events.reduce((s, ev) => s + (d.cv?.[ev] || 0), 0)), 1);
  const barWidth = Math.max(4, Math.floor(W / data.length) - 2);
  const labelStep = Math.ceil(data.length / 10);

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(f => (
        <g key={f}>
          <line x1={padding.left} y1={padding.top + H * (1 - f)} x2={padding.left + W} y2={padding.top + H * (1 - f)}
            stroke="#e2e8f0" strokeWidth={1} />
          <text x={padding.left - 4} y={padding.top + H * (1 - f) + 4} textAnchor="end" fontSize={10} fill="#999">
            {Math.round(maxVal * f)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = padding.left + (i / data.length) * W + (W / data.length - barWidth) / 2;
        let yOffset = 0;
        return (
          <g key={i}>
            {events.map((ev, ei) => {
              const val = d.cv?.[ev] || 0;
              const h = (val / maxVal) * H;
              const y = padding.top + H - (val / maxVal) * H - yOffset;
              yOffset += h;
              return (
                <rect key={ev} x={x} y={y} width={barWidth} height={h} fill={colors[ei % colors.length]} opacity={0.85} />
              );
            })}
            {i % labelStep === 0 && (
              <text x={x + barWidth / 2} y={padding.top + H + 16} textAnchor="middle" fontSize={10} fill="#888">
                {d.date?.substring(5)}
              </text>
            )}
          </g>
        );
      })}
      {/* 凡例 */}
      {events.map((ev, i) => (
        <g key={ev}>
          <rect x={padding.left + i * 120} y={padding.top + H + 34} width={10} height={10} fill={colors[i % colors.length]} />
          <text x={padding.left + i * 120 + 14} y={padding.top + H + 43} fontSize={10} fill="#555">{ev}</text>
        </g>
      ))}
    </svg>
  );
}

export default function PeriodReport() {
  const [mounted, setMounted] = useState(false);
  const [siteId, setSiteId] = useState('default');
  const [preset, setPreset] = useState('直近28日');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterMedium, setFilterMedium] = useState('');

  const [allEventNames, setAllEventNames] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [showCvDropdown, setShowCvDropdown] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const url = `/api/report?type=period&site_id=${siteId}&from=${from}&to=${to}&events=${encodeURIComponent(evParam)}&utm_source=${encodeURIComponent(filterSource)}&utm_medium=${encodeURIComponent(filterMedium)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      setData(await res.json());
    } catch (e) {
      setError('データ取得に失敗しました');
    } finally { setLoading(false); }
  }, [siteId, from, to, selectedEvents, filterSource, filterMedium]);

  useEffect(() => {
    if (mounted && from && to) fetchData();
  }, [mounted, from, to, selectedEvents]);

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

  // CSV
  const handleCsv = () => {
    if (!data?.rows) return;
    const headers = ['日付', 'セッション数', ...selectedEvents.flatMap(ev => [ev + '(件)', ev + '(CVR%)'])];
    const rows = [...data.rows].sort((a, b) => a.date.localeCompare(b.date)).map(r => [
      r.date, r.sessions,
      ...selectedEvents.flatMap(ev => [r.cv?.[ev] || 0, r.sessions > 0 ? ((r.cv?.[ev] || 0) / r.sessions * 100).toFixed(1) + '%' : '—']),
    ]);
    const csv = [headers, ...rows].map(r => r.join('\t')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `period_${from}_${to}.csv`;
    a.click();
  };

  const s = {
    card: { background: 'white', borderRadius: 8, padding: '20px 24px', marginBottom: 16 },
    btn: { padding: '5px 12px', borderRadius: 4, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13 },
    btnActive: { padding: '5px 12px', borderRadius: 4, border: 'none', background: '#1a8fc1', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: '600' },
    th: { padding: '10px 12px', fontSize: 12, color: '#666', fontWeight: '600', textAlign: 'left', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f0f4f8' },
  };

  // グラフ用: 昇順にソート
  const chartData = data?.rows ? [...data.rows].sort((a, b) => a.date.localeCompare(b.date)) : [];

  if (!mounted) return null;

  return (
    <Layout>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#2d3748' }}>期間別レポート</h2>

      {/* フィルターカード */}
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
          <span style={{ fontSize: 13 }}>〜</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }} />
          <button onClick={() => { setPreset(''); setFrom(customFrom); setTo(customTo); }}
            style={{ ...s.btn, background: '#e8771e', color: 'white', border: 'none' }}>適用</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
        {/* ソースフィルター */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555' }}>絞り込み：</span>
          <input type="text" placeholder="ソース（例: t.co）" value={filterSource} onChange={e => setFilterSource(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, width: 160 }} />
          <input type="text" placeholder="メディア（例: social）" value={filterMedium} onChange={e => setFilterMedium(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4, width: 160 }} />
          <button onClick={fetchData} style={{ ...s.btn, background: '#1a8fc1', color: 'white', border: 'none' }}>適用</button>
        </div>
      </div>

      {/* サマリーカード */}
      {data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ ...s.card, flex: '0 0 auto', minWidth: 150, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>セッション数</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2d3748' }}>{data.totalSessions?.toLocaleString()}</div>
          </div>
          {selectedEvents.map((ev, i) => (
            <div key={ev} style={{ ...s.card, flex: '0 0 auto', minWidth: 150, marginBottom: 0, borderTop: `3px solid ${CV_COLORS[i % CV_COLORS.length]}` }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{ev}</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: CV_COLORS[i % CV_COLORS.length] }}>
                {(data.totalCv?.[ev] || 0)} <span style={{ fontSize: 13, fontWeight: 'normal' }}>件</span>
              </div>
              <div style={{ fontSize: 12, color: CV_COLORS[i % CV_COLORS.length] }}>
                CVR {data.totalSessions > 0 ? (((data.totalCv?.[ev] || 0) / data.totalSessions) * 100).toFixed(2) : '0.00'}%
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>読み込み中...</div>}
      {error && <div style={{ padding: 16, color: 'red' }}>{error}</div>}

      {!loading && chartData.length > 0 && (
        <>
          {/* セッション推移グラフ */}
          <div style={s.card}>
            <h3 style={{ fontSize: 14, fontWeight: '600', marginBottom: 16, color: '#444' }}>セッション数の推移</h3>
            <LineChart data={chartData} />
          </div>

          {/* CV推移グラフ */}
          {selectedEvents.length > 0 && (
            <div style={s.card}>
              <h3 style={{ fontSize: 14, fontWeight: '600', marginBottom: 16, color: '#444' }}>マイクロコンバージョン推移</h3>
              <BarChart data={chartData} events={selectedEvents} colors={CV_COLORS} />
            </div>
          )}

          {/* 日別テーブル */}
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: '600', color: '#444', margin: 0 }}>日別データ</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafbfc' }}>
                    <th style={s.th}>日付</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>セッション数</th>
                    {selectedEvents.flatMap((ev, i) => [
                      <th key={ev + '_cnt'} style={{ ...s.th, textAlign: 'right', color: CV_COLORS[i % CV_COLORS.length] }}>{ev}(件)</th>,
                      <th key={ev + '_cvr'} style={{ ...s.th, textAlign: 'right', color: CV_COLORS[i % CV_COLORS.length] }}>CVR%</th>,
                    ])}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={s.td}>{row.date}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: '600' }}>{row.sessions}</td>
                      {selectedEvents.flatMap((ev, i) => {
                        const cnt = row.cv?.[ev] || 0;
                        const cvr = row.sessions > 0 ? ((cnt / row.sessions) * 100).toFixed(1) : '0.0';
                        return [
                          <td key={ev + '_cnt'} style={{ ...s.td, textAlign: 'right', color: cnt > 0 ? CV_COLORS[i % CV_COLORS.length] : '#ccc' }}>
                            {cnt > 0 ? `${cnt}件` : '—'}
                          </td>,
                          <td key={ev + '_cvr'} style={{ ...s.td, textAlign: 'right', color: cnt > 0 ? CV_COLORS[i % CV_COLORS.length] : '#ccc' }}>
                            {cnt > 0 ? `${cvr}%` : '—'}
                          </td>,
                        ];
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && data?.rows?.length === 0 && (
        <div style={{ ...s.card, textAlign: 'center', color: '#999', padding: 40 }}>データなし</div>
      )}
    </Layout>
  );
}
