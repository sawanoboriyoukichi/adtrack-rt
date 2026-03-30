import { useState, useEffect, useRef } from 'react';
const SYSTEM_EVENTS = new Set([
  'session_start', 'first_visit', 'user_engagement', 'page_view',
  'gtm.dom', 'gtm.load', 'gtm.js', 'gtm.click', 'gtm.linkClick',
  'gtm.formSubmit', 'gtm.historyChange', 'gtm.scrollDepth', 'gtm.timer', 'gtm.triggerGroup',
]);

const EVENT_LABELS = {
  email_registration: 'メールアドレス登録',
  line_registration: 'LINE登録',
  scroll_10_percent: 'スクロール10%',
  scroll_to_bottom: 'スクロール90%（最下部）',
  cta_click: 'CTAクリック',
  scroll: 'スクロール',
  click: 'クリック',
  file_download: 'ファイルダウンロード',
  video_start: '動画再生開始',
  video_complete: '動画再生完了',
  video_progress: '動画再生中',
  form_start: 'フォーム入力開始',
  form_submit: 'フォーム送信',
  purchase: '購入',
  add_to_cart: 'カート追加',
  begin_checkout: 'チェックアウト開始',
  sign_up: '会員登録',
  login: 'ログイン',
  search: '検索',
  share: 'シェア',
  view_item: '商品詳細閲覧',
  generate_lead: 'リード獲得',
  conversion: 'コンバージョン',
};

export function getEventLabel(eventName) {
  return EVENT_LABELS[eventName] || eventName;
}

// 常に選択肢に表示するイベント（DBにデータがなくても表示）
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

  // DBのイベントと常時表示イベントをマージ（DBのカウントを優先）
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
