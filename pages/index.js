import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import DateRangePicker from '../components/DateRangePicker';

// Helper to get safe default dates (client-side only)
function getDefaultDates() {
  if (typeof window === 'undefined') {
    // Return safe defaults during SSR
    const today = new Date();
    return {
      startDate: '2026-03-23',
      endDate: '2026-03-30',
    };
  }
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const startDate = d.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];
  return { startDate, endDate };
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(getDefaultDates().endDate);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [topPages, setTopPages] = useState([]);
  const [topEvents, setTopEvents] = useState([]);
  const [error, setError] = useState('');

  // Initialize on client only
  useEffect(() => {
    setMounted(true);
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setStartDate(d.toISOString().split('T')[0]);
    setEndDate(new Date().toISOString().split('T')[0]);
  }, []);

  const fetchData = async () => {
    if (!mounted) return;

    setLoading(true);
    setError('');
    try {
      const siteId = typeof window !== 'undefined'
        ? (localStorage.getItem('adtrack_site_id') || 'site_001')
        : 'site_001';

      // Fetch summary
      const summaryRes = await fetch(
        `/api/report?type=summary&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!summaryRes.ok) throw new Error('Summary fetch failed');
      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Fetch timeline
      const timelineRes = await fetch(
        `/api/report?type=timeline&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!timelineRes.ok) throw new Error('Timeline fetch failed');
      const timelineData = await timelineRes.json();
      setTimeline(timelineData || []);

      // Fetch top pages
      const pagesRes = await fetch(
        `/api/report?type=pageviews&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!pagesRes.ok) throw new Error('Pages fetch failed');
      const pagesData = await pagesRes.json();
      setTopPages(pagesData || []);

      // Fetch top events
      const eventsRes = await fetch(
        `/api/report?type=events&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!eventsRes.ok) throw new Error('Events fetch failed');
      const eventsData = await eventsRes.json();
      setTopEvents(eventsData || []);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchData();
    }
  }, [mounted, startDate, endDate]);

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleRefresh = () => {
    fetchData();
  };

  const maxSessions = Math.max(...timeline.map((d) => d.sessions || 0), 1);

  return (
    <Layout title="ダッシュボード">
      <div style={styles.container}>
        <h1 style={styles.title}>ダッシュボード</h1>

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          loading={loading}
          onRefresh={handleRefresh}
        />

        {error && <div style={styles.error}>{error}</div>}

        {/* Summary Cards */}
        <div style={styles.cardsGrid}>
          <SummaryCard
            label="セッション数"
            value={summary?.totalSessions || 0}
            loading={loading}
          />
          <SummaryCard
            label="ユニーク訪問者"
            value={summary?.uniqueVisitors || 0}
            loading={loading}
          />
          <SummaryCard
            label="直帰率"
            value={`${parseFloat(summary?.bounceRate || 0).toFixed(1)}%`}
            loading={loading}
          />
          <SummaryCard
            label="PV数"
            value={summary?.totalPageviews || 0}
            loading={loading}
          />
          <SummaryCard
            label="平均滞在時間"
            value={`${Math.round(summary?.avgDuration || 0)}秒`}
            loading={loading}
          />
        </div>

        {/* Timeline Chart */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>セッション推移</h2>
          <div style={styles.chart}>
            {timeline.length === 0 ? (
              <div style={styles.noData}>データなし</div>
            ) : (
              <div style={styles.barChart}>
                {timeline.map((item, idx) => {
                  const height = (item.sessions / maxSessions) * 150;
                  return (
                    <div key={idx} style={styles.barContainer}>
                      <div
                        style={{
                          ...styles.bar,
                          height: `${Math.max(height, 2)}px`,
                        }}
                        title={`${item.date}: ${item.sessions}セッション`}
                      />
                      <div style={styles.barLabel}>
                        {new Date(item.date).toLocaleDateString('ja-JP', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>トップページ</h2>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.tableCell, flex: 2 }}>ページURL</div>
              <div style={styles.tableCell}>PV数</div>
            </div>
            {topPages.length === 0 ? (
              <div style={styles.noData}>データなし</div>
            ) : (
              topPages.map((page, idx) => (
                <div key={idx} style={styles.tableRow}>
                  <div style={{ ...styles.tableCell, flex: 2, overflow: 'hidden' }}>
                    <span title={page.page_url}>
                      {(page.page_url || '').substring(0, 60)}
                    </span>
                  </div>
                  <div style={styles.tableCell}>{page.views || 0}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Events */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>トップイベント</h2>
          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div style={{ ...styles.tableCell, flex: 2 }}>イベント名</div>
              <div style={styles.tableCell}>発生件数</div>
            </div>
            {topEvents.length === 0 ? (
              <div style={styles.noData}>データなし</div>
            ) : (
              topEvents.map((event, idx) => (
                <div key={idx} style={styles.tableRow}>
                  <div style={{ ...styles.tableCell, flex: 2 }}>
                    {event.event_name || '-'}
                  </div>
                  <div style={styles.tableCell}>{event.count || 0}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SummaryCard({ label, value, loading }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardValue}>
        {loading ? (
          <div style={styles.skeleton} />
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#1a1a1a',
  },
  error: {
    backgroundColor: '#ffebee',
    color: '#c62828',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '20px',
    fontSize: '14px',
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '15px',
    marginBottom: '30px',
  },
  card: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '10px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  cardValue: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a8fc1',
  },
  skeleton: {
    height: '32px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    animation: 'pulse 1.5s infinite',
  },
  section: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '4px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#1a1a1a',
  },
  chart: {
    minHeight: '200px',
  },
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: '200px',
    gap: '8px',
  },
  barContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    height: '100%',
  },
  bar: {
    width: '100%',
    maxWidth: '30px',
    backgroundColor: '#1a8fc1',
    borderRadius: '2px 2px 0 0',
    transition: 'background-color 0.2s ease',
    cursor: 'pointer',
  },
  barLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px',
    whiteSpace: 'nowrap',
  },
  table: {
    width: '100%',
  },
  tableHeader: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
    padding: '12px',
    fontWeight: '600',
    fontSize: '13px',
    color: '#666',
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    padding: '12px',
    borderBottom: '1px solid #eee',
    fontSize: '14px',
  },
  tableCell: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  noData: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#999',
    fontSize: '14px',
  },
};

// Add keyframe animation
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);
}
