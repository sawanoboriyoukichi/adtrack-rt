import { useState } from 'react';

const PRESETS = [
  { label: '本日', start: 'today', end: 'today' },
  { label: '昨日', start: 'yesterday', end: 'yesterday' },
  { label: '直近7日', start: '7daysAgo', end: 'today' },
  { label: '直近14日', start: '14daysAgo', end: 'today' },
  { label: '直近28日', start: '28daysAgo', end: 'today' },
  { label: '直近90日', start: '90daysAgo', end: 'today' },
];

export { PRESETS };

function resolveDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateStr === 'today') return today;
  if (dateStr === 'yesterday') { const d = new Date(today); d.setDate(d.getDate()-1); return d; }
  const m = dateStr.match(/^(\d+)daysAgo$/);
  if (m) { const d = new Date(today); d.setDate(d.getDate() - parseInt(m[1])); return d; }
  return new Date(dateStr);
}

function toInputValue(dateStr) {
  return resolveDate(dateStr).toISOString().slice(0, 10);
}

export default function DateRangePicker({ startDate, endDate, onChange, loading, onRefresh }) {
  const active = PRESETS.find(p => p.start === startDate && p.end === endDate);
  const isCustom = !active;
  const [customStart, setCustomStart] = useState(() => toInputValue(startDate));
  const [customEnd, setCustomEnd] = useState(() => toInputValue(endDate));

  const applyCustom = () => {
    if (customStart && customEnd && customStart <= customEnd) onChange(customStart, customEnd);
  };

  const handlePreset = (preset) => {
    setCustomStart(toInputValue(preset.start));
    setCustomEnd(toInputValue(preset.end));
    onChange(preset.start, preset.end);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: '#666', whiteSpace: 'nowrap' }}>期間：</span>
        {PRESETS.map(preset => (
          <button key={preset.label} onClick={() => handlePreset(preset)} disabled={loading}
            style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '4px', border: (!isCustom && active?.label === preset.label) ? '1px solid #1a8fc1' : '1px solid #ccc', backgroundColor: (!isCustom && active?.label === preset.label) ? '#1a8fc1' : 'white', color: (!isCustom && active?.label === preset.label) ? 'white' : '#555', cursor: loading ? 'default' : 'pointer', fontWeight: (!isCustom && active?.label === preset.label) ? 'bold' : 'normal', opacity: loading ? 0.6 : 1, transition: 'all 0.1s' }}>
            {preset.label}
          </button>
        ))}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading}
            style={{ marginLeft: '4px', padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #1a8fc1', backgroundColor: loading ? '#ccc' : '#1a8fc1', color: 'white', cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? '取得中...' : '更新'}
          </button>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#666', whiteSpace: 'nowrap' }}>カスタム：</span>
        <input type="date" value={customStart} max={customEnd || today} onChange={e => setCustomStart(e.target.value)} disabled={loading}
          style={{ padding: '4px 8px', fontSize: '12px', border: `1px solid ${isCustom ? '#1a8fc1' : '#ccc'}`, borderRadius: '4px', color: '#333', backgroundColor: isCustom ? '#e8f4fb' : 'white' }} />
        <span style={{ fontSize: '12px', color: '#888' }}>〜</span>
        <input type="date" value={customEnd} min={customStart} max={today} onChange={e => setCustomEnd(e.target.value)} disabled={loading}
          style={{ padding: '4px 8px', fontSize: '12px', border: `1px solid ${isCustom ? '#1a8fc1' : '#ccc'}`, borderRadius: '4px', color: '#333', backgroundColor: isCustom ? '#e8f4fb' : 'white' }} />
        <button onClick={applyCustom} disabled={loading || !customStart || !customEnd || customStart > customEnd}
          style={{ padding: '5px 14px', fontSize: '12px', borderRadius: '4px', border: '1px solid #e67e22', backgroundColor: (loading || !customStart || !customEnd || customStart > customEnd) ? '#eee' : '#e67e22', color: (loading || !customStart || !customEnd || customStart > customEnd) ? '#aaa' : 'white', cursor: (loading || !customStart || !customEnd || customStart > customEnd) ? 'default' : 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
          適用
        </button>
        {isCustom && <span style={{ fontSize: '11px', color: '#e67e22', fontWeight: 'bold', whiteSpace: 'nowrap' }}>📅 {startDate} 〜 {endDate}</span>}
      </div>
    </div>
  );
}
