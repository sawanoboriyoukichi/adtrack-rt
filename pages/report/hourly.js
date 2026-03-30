import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';

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

// 時間帯別バーチャート（SVG）
function HourlyChart({ rows, peakHour }) {
  if (!rows || rows.length === 0) return null;
  const maxVal = Math.max(...rows.map(r => r.sessions), 1);
  const W = 800, H = 200;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const cW = W - pad.left - pad.right;
  const cH = H - pad.top - pad.bottom;
  const barW = Math.floor(cW / 24) - 2;

  // 色: 多いほど濃い青
  const getColor = (val) => {
    const ratio = val / maxVal;
    if (ratio >= 0.8) return '#1a5fa8';
    if (ratio >= 0.6) return '#2178c4';
    if (ratio >= 0.4) return '#3a9bd4';
    if (ratio >= 0.2) return '#6ab8e0';
    return '#a8d4ef';
  };

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {[0, 0.25, 0.5, 0.75, 1].map(f => (
          <g key={f}>
            <line x1={pad.left} y1={pad.top + cH * (1 - f)} x2={pad.left + cW} y2={pad.top + cH * (1 - f)}
              stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 4} y={pad.top + cH * (1 - f) + 4} textAnchor="end" fontSize={10} fill="#999">
              {Math.round(maxVal * f)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const h = (r.sessions / maxVal) * cH;
          const x = pad.left + i * (cW / 24) + (cW / 24 - barW) / 2;
          const y = pad.top + cH - h;
          const isPeak = r.hour === peakHour;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={h} fill={getColor(r.sessions)} opacity={isPeak ? 1 : 0.85} />
              {i % 2 === 0 && (
                <text x={x + barW / 2} y={pad.top + cH + 16} textAnchor="middle" fontSize={9} fill="#888">
                  {String(i).padStart(2, '0')}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* 凡例 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 20, height: 10, background: ['#a8d4ef', '#6ab8e0', '#3a9bd4', '#2178c4', '#1a5fa8'][Math.floor(f * 5)] }} />
          </div>
        ))}
        <span style={{ fontSize: 11, color: '#888' }}>少</span>
        <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>多</span>
      </div>
    </div>
  );
}

export default function HourlyReport() {
  const [mounted, setMounted] = useState(false);
  const [siteId, setSiteId] = useState('default');
  const [preset, setPreset] = useState('直近28日');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterMedium, setFilterMedium] = useState('');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('adtrack_site_id') : null;
    setSiteId(saved || 'default');
    const dates = getPresetDates('直近28日');
    setFrom(dates.from); setTo(dates.to);
    setCustomFrom(dates.from); setCustomTo(dates.to);
  }, []);

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true); setError('');
    try {
      const url = `/api/report?type=hourly&site_id=${siteId}&from=${from}&to=${to}&utm_source=${encodeURIComponent(filterSource)}&utm_medium=${encodeURIComponent(filterMedium)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setError('データ取得に失敗しました');
    } finally { setLoading(false); }
  }, [siteId, from, to, filterSource, filterMedium]);

  useEffect(() => {
    if (mounted && from && to) fetchData();
  }, [mounted, from, to]);

  const handlePreset = (p) => {
    setPreset(p);
    const dates = getPresetDates(p);
    setFrom(dates.from); setTo(dates.to);
    setCustomFrom(dates.from); setCustomTo(dates.to);
  };

  const s = {
    card: { background: 'white', borderRadius: 8, padding: '20px 24px', marginBottom: 16 },
    btn: { padding: '5px 12px', borderRadius: 4, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13 },
    btnActive: { padding: '5px 12px', borderRadius: 4, border: 'none', background: '#1a8fc1', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: '600' },
    th: { padding: '10px 14px', fontSize: 12, color: '#666', fontWeight: '600', textAlign: 'left', borderBottom: '1px solid #e2e8f0' },
    td: { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid #f0f4f8' },
  };

  if (!mounted) return null;

  return (
    <Layout>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#2d3748' }}>時間別レポート</h2>

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
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ ...s.card, flex: '0 0 auto', minWidth: 150, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>総セッション数</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2d3748' }}>{data.totalSessions?.toLocaleString()}</div>
          </div>
          <div style={{ ...s.card, flex: '0 0 auto', minWidth: 150, marginBottom: 0, borderTop: '3px solid #e8771e' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>ピーク時間</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8771e' }}>{data.peakHour}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{data.peakCount}件</div>
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>読み込み中...</div>}
      {error && <div style={{ padding: 16, color: 'red' }}>{error}</div>}

      {!loading && data && (
        <>
          {/* グラフ */}
          <div style={s.card}>
            <h3 style={{ fontSize: 14, fontWeight: '600', marginBottom: 16, color: '#444' }}>時間帯別セッション数</h3>
            <HourlyChart rows={data.rows} peakHour={data.peakHour} />
          </div>

          {/* テーブル */}
          <div style={{ ...s.card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: 14, fontWeight: '600', color: '#444', margin: 0 }}>時間帯別データ一覧</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  <th style={s.th}>時間帯</th>
                  <th style={{ ...s.th, textAlign: 'right', width: '60%' }}>セッション数</th>
                  <th style={{ ...s.th, textAlign: 'right' }}>構成比</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, idx) => {
                  const isPeak = row.hour === data.peakHour;
                  const barWidth = data.totalSessions > 0 ? (row.sessions / Math.max(...data.rows.map(r => r.sessions))) * 100 : 0;
                  return (
                    <tr key={idx} style={{ background: isPeak ? '#fff8f0' : idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                      <td style={{ ...s.td, color: isPeak ? '#e8771e' : '#333', fontWeight: isPeak ? '600' : 'normal' }}>
                        {row.hour} {isPeak && '⭐'}
                      </td>
                      <td style={{ ...s.td, textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ height: 8, width: `${barWidth * 0.6}%`, background: '#2aa5d8', borderRadius: 4, opacity: 0.7, minWidth: row.sessions > 0 ? 4 : 0 }} />
                          <span style={{ minWidth: 30, fontWeight: '500' }}>{row.sessions}</span>
                        </div>
                      </td>
                      <td style={{ ...s.td, textAlign: 'right', color: '#666' }}>{row.pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}
