import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  {
    label: 'レポート集計', key: 'report',
    children: [
      { label: '直接効果', href: '/report/direct' },
      { label: '期間別', href: '/report/period' },
      { label: '時間別', href: '/report/hourly' },
      { label: 'パラメーター別', href: '/report/params' },
    ],
  },
];

export default function Layout({ children, title }) {
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState(null);
  const [siteId, setSiteId] = useState('default');
  const [mounted, setMounted] = useState(false);

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
    if (typeof window !== 'undefined') localStorage.setItem('adtrack_site_id', val);
  };

  const currentPath = router.pathname;
  const activeNav = NAV_ITEMS.find(n =>
    n.href ? currentPath.startsWith(n.href) : n.children?.some(c => currentPath.startsWith(c.href))
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#edf2f7', fontFamily: 'sans-serif' }}>
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#1a8fc1', color: 'white', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '48px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'white', color: '#1a8fc1', fontWeight: 'bold', fontSize: '14px', padding: '4px 10px', borderRadius: '4px' }}>adtrack-rt</div>
          <span style={{ fontSize: '12px', opacity: 0.8 }}>リアルタイム広告効果測定</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
          {mounted && (
            <>
              <span style={{ opacity: 0.8, fontSize: '12px' }}>サイト:</span>
              <select value={siteId} onChange={handleSiteChange}
                style={{ fontSize: '12px', padding: '3px 6px', borderRadius: '4px', border: 'none', background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer' }}>
                <option value="default" style={{ color: '#333' }}>default</option>
              </select>
            </>
          )}
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ backgroundColor: '#2aa5d8', display: 'flex', alignItems: 'stretch', position: 'relative' }}>
        {NAV_ITEMS.map(item => {
          const isActive = item === activeNav;
          return (
            <div key={item.key} style={{ position: 'relative' }}
              onMouseEnter={() => item.children && setOpenMenu(item.key)}
              onMouseLeave={() => setOpenMenu(null)}>
              {item.href ? (
                <Link href={item.href} style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', color: 'white', textDecoration: 'none', fontSize: '14px', fontWeight: isActive ? 'bold' : 'normal', backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'transparent', borderBottom: isActive ? '3px solid white' : '3px solid transparent' }}>
                  {item.label}
                </Link>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', color: 'white', fontSize: '14px', fontWeight: isActive ? 'bold' : 'normal', backgroundColor: isActive ? 'rgba(0,0,0,0.2)' : 'transparent', borderBottom: isActive ? '3px solid white' : '3px solid transparent', cursor: 'pointer', userSelect: 'none' }}>
                  {item.label} ▾
                </div>
              )}
              {item.children && openMenu === item.key && (
                <div style={{ position: 'absolute', top: '100%', left: 0, backgroundColor: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '160px', zIndex: 100, borderTop: '3px solid #1a8fc1' }}>
                  {item.children.map(child => (
                    <Link key={child.href} href={child.href}
                      style={{ display: 'block', padding: '10px 16px', color: currentPath === child.href ? '#1a8fc1' : '#333', textDecoration: 'none', fontSize: '13px', fontWeight: currentPath === child.href ? 'bold' : 'normal', backgroundColor: currentPath === child.href ? '#e8f4fb' : 'transparent', borderLeft: currentPath === child.href ? '3px solid #1a8fc1' : '3px solid transparent' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#f0f8ff'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = currentPath === child.href ? '#e8f4fb' : 'transparent'}>
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* サブナビ（パンくず風タブ） */}
      {activeNav?.children && (
        <div style={{ backgroundColor: 'white', borderBottom: '1px solid #ddd', padding: '0 20px', display: 'flex', gap: '0' }}>
          {activeNav.children.map(child => (
            <Link key={child.href} href={child.href}
              style={{ display: 'inline-block', padding: '10px 18px', fontSize: '13px', color: currentPath === child.href ? '#1a8fc1' : '#555', textDecoration: 'none', borderBottom: currentPath === child.href ? '3px solid #1a8fc1' : '3px solid transparent', fontWeight: currentPath === child.href ? 'bold' : 'normal' }}>
              {child.label}
            </Link>
          ))}
        </div>
      )}

      {/* メインコンテンツ */}
      <main style={{ padding: '24px 24px', maxWidth: '1400px', margin: '0 auto' }}>
        {title && <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#333', marginBottom: '20px' }}>{title}</h1>}
        {children}
      </main>

      <footer style={{ textAlign: 'center', padding: '16px', fontSize: '11px', color: '#999', borderTop: '1px solid #e0e0e0', backgroundColor: 'white', marginTop: '40px' }}>
        Copyright © 2025 adtrack-rt
      </footer>
    </div>
  );
}
