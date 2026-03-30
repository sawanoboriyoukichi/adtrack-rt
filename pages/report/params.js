import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';

const TAB_TYPES = [
  { key: 'source', label: 'ソース(utm_source)' },
  { key: 'medium', label: 'メディア(utm_medium)' },
  { key: 'campaign', label: 'キャンペーン(utm_campaign)' },
  { key: 'term', label: 'キャンペーン用語(utm_term)' },
  { key: 'content', label: 'コンテンツ(utm_content)' },
];

// Helper to get safe default dates (client-side only)
function getDefaultDates() {
  if (typeof window === 'undefined') {
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

// Helper to aggregate raw params data by key
function aggregateParamsByTab(rawParams, tabKey) {
  const paramMap = {};

  rawParams.forEach((row) => {
    const paramValue = row[tabKey] || '(direct)';
    if (!paramMap[paramValue]) {
      paramMap[paramValue] = {
        param_value: paramValue,
        sessions: 0,
        bounces: 0,
      };
    }
    paramMap[paramValue].sessions += 1;
    if (row.bounceRate === '100.0') {
      paramMap[paramValue].bounces += 1;
    }
  });

  const totalSessions = rawParams.length;
  const result = Object.values(paramMap).map((item) => ({
    param_value: item.param_value,
    sessions: item.sessions,
    bounce_rate: item.sessions > 0
      ? ((item.bounces / item.sessions) * 100).toFixed(1)
      : '0.0',
    percentage: totalSessions > 0
      ? ((item.sessions / totalSessions) * 100).toFixed(1)
      : '0.0',
  }));

  return result.sort((a, b) => b.sessions - a.sessions);
}

export default function ParamsReport() {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(getDefaultDates().endDate);
  const [activeTab, setActiveTab] = useState('source');
  const [loading, setLoading] = useState(false);
  const [rawParamsData, setRawParamsData] = useState([]);
  const [eventsData, setEventsData] = useState([]);
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

      // Fetch raw params data
      const paramsRes = await fetch(
        `/api/report?type=params&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!paramsRes.ok) throw new Error('Params fetch failed');
      const paramsData = await paramsRes.json();
      setRawParamsData(paramsData || []);

      // Fetch events by attribution
      const eventsRes = await fetch(
        `/api/report?type=eventsbyattribution&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      const eventsData = eventsRes.ok ? await eventsRes.json() : [];
      setEventsData(eventsData || []);
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

  // Aggregate data by active tab
  const tabData = aggregateParamsByTab(rawParamsData, activeTab);
  const totalSessions = tabData.reduce((sum, item) => sum + (item.sessions || 0), 0);

  // Get unique event names from events data
  const allEventTypes = Array.from(
    new Set(eventsData.map((e) => e.eventName || '').filter(Boolean))
  );

  const getEventCount = (paramValue, eventName) => {
    // Map tab key to event property name
    const propertyMap = {
      source: 'source',
      medium: 'medium',
      campaign: 'campaign',
      term: 'term',
      content: 'content',
    };
    const propertyName = propertyMap[activeTab];

    const item = eventsData.find(
      (e) => e.eventName === eventName && e[propertyName] === paramValue
    );
    return item ? item.count : 0;
  };

  const handleExport = () => {
    const headers = ['パラメーター値', 'セッション数', '直帰率', '構成比'];
    const eventHeaders = allEventTypes;
    const allHeaders = [...headers, ...eventHeaders];

    const rows = tabData.map((item) => {
      const baseRow = [
        item.param_value || '-',
        item.sessions || 0,
        `${parseFloat(item.bounce_rate || 0).toFixed(1)}%`,
        `${parseFloat(item.percentage || 0).toFixed(1)}%`,
      ];

      // Add event data
      eventHeaders.forEach((eventType) => {
        baseRow.push(getEventCount(item.param_value, eventType));
      });

      return baseRow;
    });

    const csv = [
      allHeaders.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    downloadCsv(csv, `params_${activeTab}.csv`);
  };

  return (
    <Layout title="パラメーター別">
      <div style={styles.container}>
        <h1 style={styles.title}>パラメーター別</h1>

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          loading={loading}
          onRefresh={fetchData}
        />

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.tabsContainer}>
        <div style={styles.tabs}>
          {TAB_TYPES.map((tab) => (
            <button
              key={tab.key}
              style={{
                ...styles.tab,
                ...(activeTab === tab.key ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button style={styles.exportBtn} onClick={handleExport}>
          CSVエクスポート
        </button>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.th}>パラメーター値</th>
              <th style={styles.th}>セッション数</th>
              <th style={styles.th}>直帰率</th>
              <th style={styles.th}>構成比</th>
              {allEventTypes.map((eventType) => (
                <th key={eventType} style={styles.th}>
                  {eventType}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4 + allEventTypes.length} style={styles.noData}>
                  読み込み中...
                </td>
              </tr>
            ) : tabData.length === 0 ? (
              <tr>
                <td colSpan={4 + allEventTypes.length} style={styles.noData}>
                  データなし
                </td>
              </tr>
            ) : (
              tabData.map((item, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{item.param_value || '-'}</td>
                  <td style={styles.td}>{item.sessions || 0}</td>
                  <td style={styles.td}>
                    {parseFloat(item.bounce_rate || 0).toFixed(1)}%
                  </td>
                  <td style={styles.td}>
                    {parseFloat(item.percentage || 0).toFixed(1)}%
                  </td>
                  {allEventTypes.map((eventType) => (
                    <td key={eventType} style={styles.td}>
                      {getEventCount(item.param_value, eventType)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </Layout>
  );
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
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
  tabsContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    gap: '15px',
    flexWrap: 'wrap',
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 14px',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    color: '#666',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    backgroundColor: '#1a8fc1',
    color: 'white',
    borderColor: '#1a8fc1',
  },
  exportBtn: {
    padding: '8px 16px',
    backgroundColor: '#1a8fc1',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
  },
  tableContainer: {
    backgroundColor: 'white',
    borderRadius: '4px',
    overflow: 'auto',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHead: {
    backgroundColor: '#f5f5f5',
    borderBottom: '2px solid #ddd',
  },
  th: {
    padding: '12px',
    textAlign: 'left',
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    borderBottom: '1px solid #eee',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
    fontSize: '14px',
  },
};
