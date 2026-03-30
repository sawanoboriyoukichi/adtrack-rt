import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Layout({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [siteId, setSiteId] = useState('');
  const [siteList, setSiteList] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('adtrack_site_id');
    if (stored) setSiteId(stored);

    // Load site list from localStorage or default
    const sites = localStorage.getItem('adtrack_sites');
    if (sites) {
      setSiteList(JSON.parse(sites));
    } else {
      const defaultSites = [
        { id: 'site_001', name: 'Site 1' },
        { id: 'site_002', name: 'Site 2' },
      ];
      setSiteList(defaultSites);
      localStorage.setItem('adtrack_sites', JSON.stringify(defaultSites));
    }
    if (!stored && siteList.length > 0) {
      setSiteId(siteList[0].id);
    }
  }, []);

  const handleSiteChange = (e) => {
    const newSiteId = e.target.value;
    setSiteId(newSiteId);
    localStorage.setItem('adtrack_site_id', newSiteId);
  };

  const navItems = [
    { label: 'ダッシュボード', href: '/' },
    { label: 'セッション一覧', href: '/report/sessions' },
    { label: 'ページ別', href: '/report/pages' },
    { label: 'パラメーター別', href: '/report/params' },
    { label: 'イベント', href: '/report/events' },
  ];

  const isActive = (href) => {
    return router.pathname === href;
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <button
            style={styles.sidebarToggle}
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1 style={styles.logo}>adtrack-rt</h1>
          <div style={styles.siteSelector}>
            <label style={styles.siteLabel}>サイト:</label>
            <select
              value={siteId}
              onChange={handleSiteChange}
              style={styles.select}
            >
              {siteList.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div style={styles.main}>
        {/* Sidebar */}
        <aside
          style={{
            ...styles.sidebar,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          }}
        >
          <nav style={styles.nav}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a
                  style={{
                    ...styles.navItem,
                    ...(isActive(item.href) ? styles.navItemActive : {}),
                  }}
                >
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main style={styles.content}>{children}</main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={styles.overlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'sans-serif',
  },
  header: {
    backgroundColor: '#1a8fc1',
    color: 'white',
    padding: '0 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
    padding: '12px 0',
  },
  sidebarToggle: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'white',
    fontSize: '24px',
    cursor: 'pointer',
    marginRight: '15px',
    display: 'none',
  },
  logo: {
    margin: '0',
    fontSize: '20px',
    fontWeight: '600',
    flex: 1,
  },
  siteSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  siteLabel: {
    fontSize: '14px',
    fontWeight: '500',
  },
  select: {
    padding: '6px 10px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'white',
    color: '#333',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    display: 'flex',
    flex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    width: '100%',
  },
  sidebar: {
    width: '250px',
    backgroundColor: 'white',
    borderRight: '1px solid #e0e0e0',
    padding: '20px 0',
    transition: 'transform 0.3s ease',
    position: 'relative',
    zIndex: 50,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
  },
  navItem: {
    padding: '12px 20px',
    color: '#333',
    textDecoration: 'none',
    fontSize: '14px',
    borderLeft: '3px solid transparent',
    transition: 'all 0.2s ease',
  },
  navItemActive: {
    borderLeftColor: '#1a8fc1',
    backgroundColor: '#f0f7fb',
    color: '#1a8fc1',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
  },
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 40,
  },
};

// Responsive styles
if (typeof window !== 'undefined' && window.innerWidth < 768) {
  styles.sidebarToggle.display = 'block';
  styles.sidebar.position = 'fixed';
  styles.sidebar.height = '100vh';
  styles.sidebar.top = '56px';
  styles.sidebar.left = 0;
  styles.sidebar.zIndex = 50;
}
