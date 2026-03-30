import { useState, useEffect, useRef } from 'react';

const SYSTEM_EVENTS = new Set([
  'session_start', 'first_visit', 'user_engagement', 'page_view',
  'gtm.dom', 'gtm.load', 'gtm.js', 'gtm.click', 'gtm.linkClick',
  'gtm.formSubmit', 'gtm.historyChange', 'gtm.scrollDepth', 'gtm.timer', 'gtm.triggerGroup',
]);

const EVENT_LABELS = {
  email_registration: 'ã¡ã¼ã«ã¢ãã¬ã¹ç»é²',
  line_registration: 'LINEç»é²',
  scroll_10_percent: 'ã¹ã¯ã­ã¼ã«10%',
  scroll_to_bottom: 'ã¹ã¯ã­ã¼ã«90%ï¼æä¸é¨ï¼',
  cta_click: 'CTAã¯ãªãã¯',
  scroll: 'ã¹ã¯ã­ã¼ã«',
  click: 'ã¯ãªãã¯',
  file_download: 'ãã¡ã¤ã«ãã¦ã³ã­ã¼ã',
  video_start: 'åç»åçéå§',
  video_complete: 'åç»åçå®äº',
  video_progress: 'åç»åçä¸­',
  form_start: 'ãã©ã¼ã å¥åéå§',
  form_submit: 'ãã©ã¼ã éä¿¡',
  purchase: 'è³¼å¥',
  add_to_cart: 'ã«ã¼ãè¿½å ',
  begin_checkout: 'ãã§ãã¯ã¢ã¦ãéå§',
  sign_up: 'ä¼å¡ç»é²',
  login: 'ã­ã°ã¤ã³',
  search: 'æ¤ç´¢',
  share: 'ã·ã§ã¢',
  view_item: 'ååè©³ç´°é²è¦§',
  generate_lead: 'ãªã¼ãç²å¾',
  conversion: 'ã³ã³ãã¼ã¸ã§ã³',
};

export function getEventLabel(eventName) {
  return EVENT_LABELS[eventName] || eventName;
}

// å¸¸ã«é¸æè¢ã«è¡¨ç¤ºããã¤ãã³ãï¼DBã«ãã¼ã¿ããªãã¦ãè¡¨ç¤ºï¼
const ALWAYS_AVAILABLE_EVENTS = [
  { name: 'email_registration', count: 0 },
  { name: 'line_registration', count: 0 },
  { name: 'scroll_10_percent', count: 0 },
  { name: 'scroll_to_bottom', count: 0 },
  { name: 'cta_click', count: 0 },
  { name: 'video_start', count: 0 },
  { name: 'video_progress', count: 0 },
  { name: 'video_complete', count: 0 },
];

const STORAGE_KEY = 'adtrack_cv_presets';

function loadPresets() {
  if (typeof window === 'undefined') return [];
  try {
    const d = localStorage.getItem(STORAGE_KEY);
    return d ? JSON.parse(d) : [];
  } catch { return []; }
}

function persistPresets(presets) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch {}
}

export default function MicroConversionSelector({ events, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [savedPresets, setSavedPresets] = useState([]);
  const [savingMode, setSavingMode] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activePresetId, setActivePresetId] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => { setSavedPresets(loadPresets()); }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // DBã®ã¤ãã³ãã¨å¸¸æè¡¨ç¤ºã¤ãã³ãããã¼ã¸ï¼DBã®ã«ã¦ã³ããåªåï¼
  const mergedEvents = [...events];
  ALWAYS_AVAILABLE_EVENTS.forEach(ae => {
    if (!mergedEvents.find(e => e.name === ae.name)) {
      mergedEvents.push(ae);
    }
  });

  const visibleEvents = mergedEvents.filter(e =>
    !SYSTEM_EVENTS.has(e.name) &&
    (search === '' ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      getEventLabel(e.name).toLowerCase().includes(search.toLowerCase()))
  );

  const toggleEvent = (name) => {
    setActivePresetId(null);
    if (selected.includes(name)) onChange(selected.filter(s => s !== name));
    else onChange([...selected, name]);
  };

  const moveUp = (idx) => {
    if (idx === 0) return;
    const arr = [...selected];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    onChange(arr);
  };

  const moveDown = (idx) => {
    if (idx === selected.length - 1) return;
    const arr = [...selected];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    onChange(arr);
  };

  const clearAll = () => { onChange([]); setActivePresetId(null); };

  const applyPreset = (preset) => {
    onChange([...preset.events]);
    setActivePresetId(preset.id);
    setIsOpen(false);
  };

  const saveCurrentPreset = () => {
    if (!saveName.trim() || selected.length === 0) return;
    const newPreset = { id: Date.now().toString(), name: saveName.trim(), events: [...selected] };
    const updated = [...savedPresets, newPreset];
    setSavedPresets(updated);
    persistPresets(updated);
    setActivePresetId(newPreset.id);
    setSaveName('');
    setSavingMode(false);
  };

  const deletePreset = (id) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    persistPresets(updated);
    if (activePresetId === id) setActivePresetId(null);
  };

  const overwritePreset = (preset) => {
    const updated = savedPresets.map(p => p.id === preset.id ? { ...p, events: [...selected] } : p);
    setSavedPresets(updated);
    persistPresets(updated);
    setActivePresetId(preset.id);
  };

  const btnBase = { border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px', padding: '2px 6px', lineHeight: '1.4' };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }} ref={dropdownRef}>

      {savedPresets.map(preset => (
        <button key={preset.id} onClick={() => applyPreset(preset)}
          title={`${preset.events.map(getEventLabel).join(' / ')}`}
          style={{
            padding: '4px 10px', fontSize: '11px', borderRadius: '12px',
            border: `1.5px solid ${activePresetId === preset.id ? '#1a8fc1' : '#b0d4e8'}`,
            backgroundColor: activePresetId === preset.id ? '#1a8fc1' : '#e8f4fb',
            color: activePresetId === preset.id ? 'white' : '#1a8fc1',
            cursor: 'pointer', fontWeight: activePresetId === preset.id ? 'bold' : 'normal',
            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
          }}
        >
          {preset.name}
          <span onClick={e => { e.stopPropagation(); deletePreset(preset.id); }}
            style={{ fontSize: '11px', opacity: 0.6, marginLeft: '2px', lineHeight: 1 }} title="åé¤">x</span>
        </button>
      ))}

      <button onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '5px 14px', fontSize: '12px', borderRadius: '4px',
          border: '1px solid #1a8fc1',
          backgroundColor: isOpen ? '#1a8fc1' : 'white',
          color: isOpen ? 'white' : '#1a8fc1',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
        }}
      >
        <span>CVé¸æ</span>
        {selected.length > 0 && (
          <span style={{
            backgroundColor: isOpen ? 'white' : '#1a8fc1',
            color: isOpen ? '#1a8fc1' : 'white',
            borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 'bold'
          }}>{selected.length}</span>
        )}
        <span style={{ fontSize: '10px' }}>{isOpen ? 'v' : '>'}</span>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
          backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '6px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 2000,
          width: '340px', maxHeight: '580px', display: 'flex', flexDirection: 'column'
        }}>

          <div style={{ padding: '10px 14px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#333' }}>ãã¤ã¯ã­ã³ã³ãã¼ã¸ã§ã³</span>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>x</button>
          </div>

          {savedPresets.length > 0 && (
            <div style={{ borderBottom: '1px solid #eee', backgroundColor: '#f8fbff' }}>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', color: '#1a8fc1', fontWeight: 'bold' }}>ä¿å­æ¸ã¿ã»ãã</div>
              {savedPresets.map(preset => (
                <div key={preset.id} style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #edf2f7', backgroundColor: activePresetId === preset.id ? '#e8f4fb' : 'transparent' }}>
                  <button onClick={() => applyPreset(preset)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: activePresetId === preset.id ? 'bold' : 'normal', color: activePresetId === preset.id ? '#1a8fc1' : '#333' }}>
                      {activePresetId === preset.id && '> '}{preset.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#aaa', marginTop: '1px' }}>
                      {preset.events.slice(0, 3).map(getEventLabel).join(' / ')}{preset.events.length > 3 ? ` ä»${preset.events.length - 3}ä»¶` : ''}
                    </div>
                  </button>
                  {activePresetId === preset.id && (
                    <button onClick={() => overwritePreset(preset)}
                      style={{ ...btnBase, backgroundColor: '#e8f4fb', color: '#1a8fc1', fontSize: '10px' }} title="ç¾å¨ã®é¸æã§ä¸æ¸ã">æ´æ°</button>
                  )}
                  <button onClick={() => deletePreset(preset.id)}
                    style={{ ...btnBase, backgroundColor: '#fff0f0', color: '#e53935' }} title="åé¤">x</button>
                </div>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <div style={{ borderBottom: '1px solid #eee', backgroundColor: '#f0f8ff' }}>
              <div style={{ padding: '8px 14px 4px', fontSize: '11px', color: '#1a8fc1', fontWeight: 'bold' }}>é¸æä¸­</div>
              {selected.map((name, idx) => (
                <div key={name} style={{ padding: '5px 14px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: idx < selected.length - 1 ? '1px solid #daeeff' : 'none' }}>
                  <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#1a8fc1', color: 'white', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{idx + 1}</span>
                  <span style={{ flex: 1, fontSize: '12px', color: '#1a8fc1', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getEventLabel(name)}</span>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ ...btnBase, backgroundColor: idx === 0 ? '#f0f0f0' : '#e8f4fb', color: idx === 0 ? '#ccc' : '#1a8fc1' }}>up</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === selected.length - 1} style={{ ...btnBase, backgroundColor: idx === selected.length - 1 ? '#f0f0f0' : '#e8f4fb', color: idx === selected.length - 1 ? '#ccc' : '#1a8fc1' }}>dn</button>
                  <button onClick={() => toggleEvent(name)} style={{ ...btnBase, backgroundColor: '#fff0f0', color: '#e53935' }}>x</button>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '8px 14px', borderBottom: '1px solid #f0f0f0' }}>
            <input type="text" placeholder="ã¤ãã³ãåãæ¤ç´¢..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '5px 10px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
              <button onClick={clearAll} style={{ fontSize: '11px', padding: '3px 10px', border: '1px solid #ccc', color: '#666', borderRadius: '3px', background: 'white', cursor: 'pointer' }}>ã¯ãªã¢</button>
              <span style={{ fontSize: '11px', color: '#888', marginLeft: 'auto' }}>{visibleEvents.length}ä»¶ / {selected.length}é¸æä¸­</span>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {visibleEvents.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                {mergedEvents.length === 0 ? 'ãã¼ã¿åå¾ä¸­...' : 'è¦ã¤ããã¾ãã'}
              </div>
            ) : visibleEvents.map(ev => {
              const checked = selected.includes(ev.name);
              const order = selected.indexOf(ev.name);
              const label = getEventLabel(ev.name);
              return (
                <div key={ev.name} onClick={() => toggleEvent(ev.name)}
                  style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', backgroundColor: checked ? '#e8f4fb' : 'white', borderBottom: '1px solid #f5f5f5' }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.backgroundColor = '#f5f5f5'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = checked ? '#e8f4fb' : 'white'; }}
                >
                  <div style={{ width: '16px', height: '16px', borderRadius: '3px', flexShrink: 0, border: `2px solid ${checked ? '#1a8fc1' : '#ccc'}`, backgroundColor: checked ? '#1a8fc1' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {checked && <span style={{ color: 'white', fontSize: '10px', lineHeight: 1 }}>v</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: checked ? '#1a8fc1' : '#333', fontWeight: checked ? 'bold' : 'normal' }}>
                      {checked && <span style={{ fontSize: '10px', backgroundColor: '#1a8fc1', color: 'white', borderRadius: '9px', padding: '1px 5px', marginRight: '5px' }}>{order + 1}</span>}
                      {label}
                    </div>
                    {label !== ev.name && <div style={{ fontSize: '10px', color: '#aaa', fontFamily: 'monospace' }}>{ev.name}</div>}
                  </div>
                  <span style={{ fontSize: '11px', color: ev.count === 0 ? '#ccc' : '#aaa', flexShrink: 0 }}>
                    {ev.count === 0 ? '-' : ev.count.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '2px solid #eee', backgroundColor: '#fafafa', borderRadius: '0 0 6px 6px' }}>
            {savingMode ? (
              <div>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px', fontWeight: 'bold' }}>ãã®ã»ããã«ååãã¤ãã¦ä¿å­</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                    placeholder="ä¾: LINEç»é²ã­ã£ã³ãã¼ã³" autoFocus
                    onKeyDown={e => e.key === 'Enter' && saveCurrentPreset()}
                    style={{ flex: 1, padding: '5px 10px', fontSize: '12px', border: '1px solid #1a8fc1', borderRadius: '4px' }} />
                  <button onClick={saveCurrentPreset} disabled={!saveName.trim()}
                    style={{ padding: '5px 12px', fontSize: '12px', backgroundColor: saveName.trim() ? '#1a8fc1' : '#ccc', color: 'white', border: 'none', borderRadius: '4px', cursor: saveName.trim() ? 'pointer' : 'default' }}>
                    ä¿å­
                  </button>
                  <button onClick={() => { setSavingMode(false); setSaveName(''); }}
                    style={{ padding: '5px 10px', fontSize: '12px', backgroundColor: '#eee', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    x
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '11px', color: '#aaa', margin: 0 }}>é¸æããçµã¿åãããä¿å­ãã¦åå©ç¨</p>
                <button onClick={() => { setSavingMode(true); setSaveName(''); }}
                  disabled={selected.length === 0}
                  style={{
                    padding: '5px 12px', fontSize: '12px', borderRadius: '4px',
                    border: '1px solid #1a8fc1',
                    backgroundColor: selected.length === 0 ? '#f5f5f5' : 'white',
                    color: selected.length === 0 ? '#ccc' : '#1a8fc1',
                    cursor: selected.length === 0 ? 'default' : 'pointer',
                    fontWeight: 'bold', whiteSpace: 'nowrap'
                  }}>
                  ãã®ã»ãããä¿å­
                </button>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
