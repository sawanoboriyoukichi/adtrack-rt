import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [siteId, setSiteId] = useState('default');
  const [sites, setSites] = useState(['default']);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('adtrack_site_id');
      if (saved) setSiteId(saved);
    }
  }, []);

  const handleSiteChange = (e) => {
    const val = e.target.value;
    setSiteId(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('adtrack_site_id', val);
    }
  };

  const tabs = [
    { label: '直接効果', href: '/report/direct' },
    { label: '期間別', href: '/report/period' },
    { label: '時間別', href: '/report/hourly' },
    { label: 'パラメーター別', href: '/report/params' },
  ];

  const currentPath = router.pathname;

  return (
    <div style={{ minHeight: '100vh', background: '#edf2f7', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <header style={{
        background: '#1a8fc1',
        color: 'white',
        padding: '0 16px',
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            background: 'white',
            color: '#1a8fc1',
            fontWeight: 'bold',
            fontSize: 13,
            padding: '3px 8px',
            borderRadius: 4,
          }}>adtrack-rt</span>
          <span style={{ fontSize: 13, opacity: 0.9 }}>リアルタイム広告効果測定</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mounted && (
            <>
              <span style={{ fontSize: 12, opacity: 0.8 }}>サイト:</span>
              <select
                value={siteId}
                onChange={handleSiteChange}
                style={{
                  fontSize: 12,
                  padding: '3px 6px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                {sites.map(s => (
                  <option key={s} value={s} style={{ color: '#333' }}>{s}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </header>

      {/* タブナビゲーション */}
      <nav style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '0 16px' }}>
        <div style={{ display: 'flex', maxWidth: 1400, margin: '0 auto' }}>
          {tabs.map(tab => {
            const isActive = currentPath === tab.href || currentPath.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                style={{
                  display: 'inline-block',
                  padding: '12px 18px',
                  fontSize: 13,
                  fontWeight: isActive ? '600' : 'normal',
                  color: isActive ? '#1a8fc1' : '#555',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid #1a8fc1' : '2px solid transparent',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* コンテンツ */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 16px' }}>
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: '#999' }}>
        adtrack-rt © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
