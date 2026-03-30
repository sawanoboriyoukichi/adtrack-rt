import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children, activeTab }) {
  const router = useRouter();
  const [siteId, setSiteId] = useState('');
  const [siteList, setSiteList] = useState([{ id: 'default', name: 'デフォルト' }]);

  useEffect(() => {
    const stored = localStorage.getItem('adtrack_rt_site_id');
    const sites = localStorage.getItem('adtrack_rt_sites');
    if (sites) {
      const parsed = JSON.parse(sites);
      setSiteList(parsed);
      setSiteId(stored || parsed[0]?.id || 'default');
    } else {
      const defaults = [{ id: 'default', name: 'デフォルト' }];
      setSiteList(defaults);
      setSiteId(stored || 'default');
    }
  }, []);

  const handleSiteChange = (e) => {
    const val = e.target.value;
    setSiteId(val);
    localStorage.setItem('adtrack_rt_site_id', val);
    router.reload();
  };

  const tabs = [
    { label: 'ダッシュボード', href: '/' },
    { label: 'セッション一覧', href: '/report/sessions' },
    { label: 'ページ別', href: '/report/pages' },
    { label: 'パラメーター別', href: '/report/params' },
    { label: 'イベント', href: '/report/events' },
  ];

  const currentPath = router.pathname;

  return (
    <div style={s.wrap}>
      {/* ヘッダー */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.brand}>
            <span style={s.brandText}>adtrack-rt</span>
            <span style={s.headerSub}>リアルタイムアクセス計測</span>
          </div>
          <div style={s.headerRight}>
            <label style={s.siteLabel}>サイト：</label>
            <select value={siteId} onChange={handleSiteChange} style={s.siteSelect}>
              {siteList.map(site => (
                <option key={site.id} value={site.id}>{site.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav style={s.tabBar}>
        <div style={s.tabInner}>
          {tabs.map(tab => (
            <Link key={tab.href} href={tab.href} style={{
              ...s.tab,
              ...(currentPath === tab.href ? s.tabActive : {}),
            }}>
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* コンテンツ */}
      <main style={s.content}>
        <div style={s.inner}>
          {children}
        </div>
      </main>

      {/* フッター */}
      <footer style={s.footer}>
        adtrack-rt — GA4非依存リアルタイム計測
      </footer>
    </div>
  );
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#edf2f7',
  },
  header: {
    backgroundColor: '#1a8fc1',
    color: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 20px',
    height: '48px',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  brandText: {
    fontSize: '18px',
    fontWeight: '700',
    letterSpacing: '0.5px',
  },
  headerSub: {
    fontSize: '12px',
    opacity: 0.8,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  siteLabel: {
    fontSize: '13px',
    opacity: 0.9,
  },
  siteSelect: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#333',
    fontSize: '13px',
    cursor: 'pointer',
  },
  tabBar: {
    backgroundColor: 'white',
    borderBottom: '1px solid #dde3ea',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  tabInner: {
    display: 'flex',
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '0 20px',
  },
  tab: {
    display: 'inline-block',
    padding: '12px 18px',
    fontSize: '13px',
    fontWeight: '500',
    color: '#555',
    borderBottom: '3px solid transparent',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s, border-color 0.15s',
    textDecoration: 'none',
  },
  tabActive: {
    color: '#1a8fc1',
    borderBottomColor: '#1a8fc1',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: '24px 20px',
  },
  inner: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  footer: {
    textAlign: 'center',
    padding: '12px',
    fontSize: '12px',
    color: '#aaa',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: 'white',
  },
};
