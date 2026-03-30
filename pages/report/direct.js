import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';

// 色配列（CVカラム用）
const CV_COLORS = ['#e8771e', '#c75393', '#2196f3', '#4caf50', '#9c27b0', '#ff5722'];

// 日付プリセット
function getPresetDates(preset) {
  const now = new Date();
  const fmt = (d) => d.toISOString().substring(0, 10);
  const today = fmt(now);
  const yesterday = fmt(new Date(now - 86400000));
  switch (preset) {
    case '今日': return { from: today, to: today };
    case '昨日': return { from: yesterday, to: yesterday };
    case '直近7日': return { from: fmt(new Date(now - 6 * 86400000)), to: today };
    case '直近14日': return { from: fmt(new Date(now - 13 * 86400000)), to: today };
    case '直近28日': return { from: fmt(new Date(now - 27 * 86400000)), to: today };
    case '直近90日': return { from: fmt(new Date(now - 89 * 86400000)), to: today };
    default: return { from: fmt(new Date(now - 27 * 86400000)), to: today };
  }
}

const PRESETS = ['今日', '昨日', '直近7日', '直近14日', '直近28日', '直近90日'];
const UTM_TABS = [
  { key: 'all', label: 'すべて' },
  { key: 'source', label: 'ソース (utm_source)' },
  { key: 'medium', label: 'メディア (utm_medium)' },
  { key: 'campaign', label: 'キャンペーン (utm_campaign)' },
  { key: 'term', label: 'キャンペーン用語 (utm_term)' },
  { key: 'content', label: 'コンテンツ (utm_content)' },
];

const PAGE_SIZE = 10;

export default function DirectReport() {
  const [mounted, setMounted] = useState(false);
  const [siteId, setSiteId] = useState('default');
  const [preset, setPreset] = useState('直近28日');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // マイクロCV
  const [allEventNames, setAllEventNames] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [showCvDropdown, setShowCvDropdown] = useState(false);

  // フィルター
  const [search, setSearch] = useState('');
  const [utmTab, setUtmTab] = useState('all');

  // データ
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ソート
  const [sortKey, setSortKey] = useState('sessions');
  const [sortDir, setSortDir] = useState('desc');

  // ページネーション
  const [page, setPage] = useState(1);

  useEffect(() => {
    setMounted(true);
    const saved = typeof window !== 'undefined' ? localStorage.getItem('adtrack_site_id') : null;
    const sid = saved || 'default';
    setSiteId(sid);

    const savedEvents = typeof window !== 'undefined' ? localStorage.getItem('adtrack_selected_events') : null;

    const dates = getPresetDates('直近28日');
    setFrom(dates.from);
    setTo(dates.to);
    setCustomFrom(dates.from);
    setCustomTo(dates.to);

    // イベント名取得
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
      })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError('');
    try {
      const evParam = selectedEvents.join(',');
      const url = `/api/report?type=direct&site_id=${siteId}&from=${from}&to=${to}&events=${encodeURIComponent(evParam)}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      setData(json);
      setPage(1);
    } catch (e) {
      setError('データ取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [siteId, from, to, selectedEvents, search]);

  useEffect(() => {
    if (mounted && from && to) fetchData();
  }, [mounted, from, to, selectedEvents]);

  const handlePreset = (p) => {
    setPreset(p);
    const dates = getPresetDates(p);
    setFrom(dates.from);
    setTo(dates.to);
    setCustomFrom(dates.from);
    setCustomTo(dates.to);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      setPreset('');
      setFrom(customFrom);
      setTo(customTo);
    }
  };

  const handleUpdate = () => fetchData();

  const toggleEvent = (evName) => {
    const next = selectedEvents.includes(evName)
      ? selectedEvents.filter(e => e !== evName)
      : [...selectedEvents, evName];
    setSelectedEvents(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adtrack_selected_events', JSON.stringify(next));
    }
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  // UTMタブでフィルタリングした行
  const getFilteredRows = () => {
    if (!data?.rows) return [];
    let rows = [...data.rows];

    // UTMタブフィルター
    if (utmTab !== 'all') {
      const seen = new Set();
      rows = rows.filter(r => {
        const key = utmTab === 'source' ? r.source
          : utmTab === 'medium' ? r.medium
          : utmTab === 'campaign' ? r.campaign
          : utmTab === 'term' ? r.campaign // term用（直接効果はcampaignまで）
          : r.source;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // ソート
    rows.sort((a, b) => {
      let av, bv;
      if (sortKey === 'sessions') { av = a.sessions; bv = b.sessions; }
      else if (sortKey === 'bounceRate') { av = parseFloat(a.bounceRate); bv = parseFloat(b.bounceRate); }
      else if (sortKey.startsWith('cv_')) {
        const ev = sortKey.slice(3);
        av = a.cv?.[ev] || 0; bv = b.cv?.[ev] || 0;
      } else { av = a.sessions; bv = b.sessions; }
      return sortDir === 'desc' ? bv - av : av - bv;
    });

    return rows;
  };

  const filteredRows = getFilteredRows();
  const totalPages = Math.ceil(filteredRows.length / PAGE_SIZE);
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // CSV出力
  const handleCsv = () => {
    if (!data?.rows) return;
    const headers = ['ソース', 'メディア', 'キャンペーン', 'セッション', '直帰率',
      ...selectedEvents.flatMap(ev => [ev + '(件)', ev + '(CVR%)'])];
    const rows2 = filteredRows.map(r => [
      r.source, r.medium, r.campaign, r.sessions, r.bounceRate + '%',
      ...selectedEvents.flatMap(ev => [r.cv?.[ev] || 0, r.sessions > 0 ? ((r.cv?.[ev] || 0) / r.sessions * 100).toFixed(1) + '%' : '—']),
    ]);
    const csv = [headers, ...rows2].map(r => r.join('\t')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `direct_${from}_${to}.csv`;
    a.click();
  };

  const s = {
    card: { background: 'white', borderRadius: 8, padding: '20px 24px', marginBottom: 16 },
    btn: { padding: '5px 12px', borderRadius: 4, border: '1px solid #ccc', background: 'white', cursor: 'pointer', fontSize: 13 },
    btnActive: { padding: '5px 12px', borderRadius: 4, border: 'none', background: '#1a8fc1', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: '600' },
    th: { padding: '10px 12px', fontSize: 12, color: '#666', fontWeight: '600', textAlign: 'left', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' },
    td: { padding: '10px 12px', fontSize: 13, borderBottom: '1px solid #f0f4f8', verticalAlign: 'middle' },
  };

  if (!mounted) return null;

  return (
    <Layout>
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, color: '#2d3748' }}>直接効果レポート</h2>

      {/* 日付・フィルターカード */}
      <div style={s.card}>
        {/* 期間プリセット */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555', marginRight: 4 }}>期間：</span>
          {PRESETS.map(p => (
            <button key={p} onClick={() => handlePreset(p)} style={preset === p ? s.btnActive : s.btn}>{p}</button>
          ))}
          <button onClick={handleUpdate} style={{ ...s.btn, background: '#2aa5d8', color: 'white', border: 'none', marginLeft: 4 }}>更新</button>
        </div>
        {/* カスタム日付 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: '#555' }}>カスタム：</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }} />
          <span style={{ fontSize: 13 }}>〜</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ fontSize: 13, padding: '4px 8px', border: '1px solid #ccc', borderRadius: 4 }} />
          <button onClick={handleCustomApply} style={{ ...s.btn, background: '#e8771e', color: 'white', border: 'none' }}>適用</button>
        </div>
        {/* 検索・CV・CSV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="ソース / メディア / キャンペーン / 用語 /"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchData()}
            style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #ccc', borderRadius: 4, width: 260 }}
          />
          {/* CV選択ドロップダウン */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCvDropdown(v => !v)}
              style={{ ...s.btn, background: '#1a8fc1', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              📊 マイクロCV選択 {selectedEvents.length > 0 && <span style={{ background: 'rgba(255,255,255,0.3)', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{selectedEvents.length}</span>} ▼
            </button>
            {showCvDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, zIndex: 100, background: 'white',
                border: '1px solid #ccc', borderRadius: 6, padding: 8, minWidth: 220, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}>
                {allEventNames.length === 0
                  ? <div style={{ fontSize: 13, color: '#999', padding: '4px 8px' }}>イベントなし</div>
                  : allEventNames.map(ev => (
                    <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', cursor: 'pointer', borderRadius: 4, hover: { background: '#f5f5f5' } }}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.includes(ev)}
                        onChange={() => toggleEvent(ev)}
                      />
                      <span style={{ fontSize: 13 }}>{ev}</span>
                    </label>
                  ))
                }
              </div>
            )}
          </div>
          {/* 選択中CVタグ */}
          {selectedEvents.map((ev, i) => (
            <span key={ev} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
              background: `${CV_COLORS[i % CV_COLORS.length]}22`,
              border: `1px solid ${CV_COLORS[i % CV_COLORS.length]}`,
              color: CV_COLORS[i % CV_COLORS.length], borderRadius: 12, padding: '2px 8px',
            }}>
              {ev}
              <span onClick={() => toggleEvent(ev)} style={{ cursor: 'pointer', fontWeight: 'bold' }}>×</span>
            </span>
          ))}
          <button onClick={handleCsv} style={{ ...s.btn, background: '#27ae60', color: 'white', border: 'none', marginLeft: 'auto' }}>📥 CSV</button>
        </div>
      </div>

      {/* サマリーカード */}
      {data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ ...s.card, flex: '0 0 auto', minWidth: 130, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>セッション数</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2d3748' }}>{data.totalSessions?.toLocaleString()}</div>
          </div>
          <div style={{ ...s.card, flex: '0 0 auto', minWidth: 130, marginBottom: 0 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>流入元数</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2196f3' }}>{data.uniqueSources} <span style={{ fontSize: 14, fontWeight: 'normal' }}>件</span></div>
          </div>
          {selectedEvents.map((ev, i) => (
            <div key={ev} style={{ ...s.card, flex: '0 0 auto', minWidth: 130, marginBottom: 0, borderTop: `3px solid ${CV_COLORS[i % CV_COLORS.length]}` }}>
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

      {/* UTMタブ */}
      <div style={{ background: 'white', borderRadius: '8px 8px 0 0', borderBottom: '1px solid #e2e8f0', marginBottom: 0, padding: '0 16px', display: 'flex', gap: 0, overflowX: 'auto' }}>
        {UTM_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setUtmTab(t.key); setPage(1); }}
            style={{
              padding: '11px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: 'none',
              borderBottom: utmTab === t.key ? '2px solid #1a8fc1' : '2px solid transparent',
              color: utmTab === t.key ? '#1a8fc1' : '#555',
              fontWeight: utmTab === t.key ? '600' : 'normal',
              whiteSpace: 'nowrap',
            }}
          >{t.label}</button>
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
            <span style={{ marginLeft: 'auto', color: '#888' }}>{filteredRows.length} 件</span>
          </div>
        )}
        {loading && <div style={{ padding: 32, textAlign: 'center', color: '#888' }}>読み込み中...</div>}
        {error && <div style={{ padding: 16, color: 'red' }}>{error}</div>}
        {!loading && data && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafbfc' }}>
                  <th style={s.th} onClick={() => handleSort('source')}>ソース {sortKey === 'source' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</th>
                  <th style={s.th} onClick={() => handleSort('medium')}>メディア {sortKey === 'medium' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</th>
                  <th style={s.th} onClick={() => handleSort('campaign')}>キャンペーン {sortKey === 'campaign' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</th>
                  <th style={{ ...s.th, textAlign: 'right' }} onClick={() => handleSort('sessions')}>セッション {sortKey === 'sessions' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</th>
                  <th style={{ ...s.th, textAlign: 'right' }} onClick={() => handleSort('bounceRate')}>直帰率 {sortKey === 'bounceRate' ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</th>
                  {selectedEvents.map((ev, i) => (
                    <th key={ev} style={{ ...s.th, textAlign: 'right', color: CV_COLORS[i % CV_COLORS.length], borderLeft: `2px solid ${CV_COLORS[i % CV_COLORS.length]}33` }}
                      onClick={() => handleSort(`cv_${ev}`)}>
                      <div>{ev}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{ev} {sortKey === `cv_${ev}` ? (sortDir === 'desc' ? '↓' : '↑') : '↕'}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                    <td style={s.td}><span style={{ color: '#1a8fc1', fontWeight: '500' }}>{row.source}</span></td>
                    <td style={s.td}>{row.medium}</td>
                    <td style={s.td}>{row.campaign}</td>
                    <td style={{ ...s.td, textAlign: 'right', fontWeight: '600' }}>{row.sessions}</td>
                    <td style={{ ...s.td, textAlign: 'right', color: parseFloat(row.bounceRate) > 70 ? '#e74c3c' : '#555' }}>{row.bounceRate}%</td>
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
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={5 + selectedEvents.length} style={{ padding: 32, textAlign: 'center', color: '#999' }}>データなし</td></tr>
                )}
                {/* 合計行 */}
                {data && pageRows.length > 0 && (
                  <tr style={{ background: '#f5f7fa', fontWeight: '600', borderTop: '2px solid #e2e8f0' }}>
                    <td style={s.td} colSpan={3}>合計</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>{data.totalSessions}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>—</td>
                    {selectedEvents.map((ev, i) => {
                      const total = data.totalCv?.[ev] || 0;
                      const cvr = data.totalSessions > 0 ? ((total / data.totalSessions) * 100).toFixed(1) : '0.0';
                      return (
                        <td key={ev} style={{ ...s.td, textAlign: 'right', borderLeft: `2px solid ${CV_COLORS[i % CV_COLORS.length]}33` }}>
                          <div style={{ color: CV_COLORS[i % CV_COLORS.length] }}>{total}件</div>
                          <div style={{ fontSize: 11, color: CV_COLORS[i % CV_COLORS.length] }}>{cvr}%</div>
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* ページネーション */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end', gap: 4, borderTop: '1px solid #e2e8f0' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={s.btn}>前へ</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} style={page === p ? s.btnActive : s.btn}>{p}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={s.btn}>次へ</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
