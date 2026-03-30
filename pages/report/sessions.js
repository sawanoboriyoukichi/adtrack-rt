import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import DateRangePicker from '../../components/DateRangePicker';

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

export default function SessionsReport() {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(getDefaultDates().endDate);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [filteredSessions, setFilteredSessions] = useState([]);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('started_at');
  const [sortDir, setSortDir] = useState('desc');

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
      const res = await fetch(
        `/api/report?type=sessions&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!res.ok) throw new Error('Sessions fetch failed');
      const data = await res.json();
      setSessions(data || []);
      setFilteredSessions(data || []);
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

  useEffect(() => {
    let filtered = sessions.filter((session) => {
      const searchLower = searchText.toLowerCase();
      return (
        (session.visitor_id || '').toLowerCase().includes(searchLower) ||
        (session.landing_page || '').toLowerCase().includes(searchLower) ||
        (session.utm_source || '').toLowerCase().includes(searchLower) ||
        (session.utm_medium || '').toLowerCase().includes(searchLower) ||
        (session.utm_campaign || '').toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }

      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredSessions(filtered);
  }, [searchText, sortField, sortDir, sessions]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExport = () => {
    const headers = [
      '開始日時',
      'visitor_id',
      'ランディングページ',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'PV数',
      '直帰',
      '滞在時間',
      'デバイス',
    ];

    const rows = filteredSessions.map((session) => [
      new Date(session.started_at).toLocaleString('ja-JP'),
      (session.visitor_id || '').substring(0, 8) + '...',
      session.landing_page || '-',
      session.utm_source || '-',
      session.utm_medium || '-',
      session.utm_campaign || '-',
      session.page_count || 0,
      session.is_bounce ? 'はい' : 'いいえ',
      Math.round(session.duration_seconds || 0),
      session.device_type || '-',
    ]);

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    downloadCsv(csv, 'sessions.csv');
  };

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const truncateId = (id) => {
    return id ? id.substring(0, 8) + '...' : '-';
  };

  const sortIndicator = (field) => {
    if (sortField !== field) return ' ⇅';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <Layout title="セッション一覧">
      <div style={styles.container}>
        <h1 style={styles.title}>セッション一覧</h1>

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={handleDateChange}
          loading={loading}
          onRefresh={fetchData}
        />

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="検索..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={styles.searchInput}
        />
        <button style={styles.exportBtn} onClick={handleExport}>
          CSVエクスポート
        </button>
        <span style={styles.count}>
          {filteredSessions.length}件
        </span>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.th} onClick={() => handleSort('started_at')}>
                開始日時{sortIndicator('started_at')}
              </th>
              <th style={styles.th} onClick={() => handleSort('visitor_id')}>
                visitor_id{sortIndicator('visitor_id')}
              </th>
              <th style={styles.th} onClick={() => handleSort('landing_page')}>
                ランディングページ{sortIndicator('landing_page')}
              </th>
              <th style={styles.th} onClick={() => handleSort('utm_source')}>
                utm_source{sortIndicator('utm_source')}
              </th>
              <th style={styles.th} onClick={() => handleSort('utm_medium')}>
                utm_medium{sortIndicator('utm_medium')}
              </th>
              <th style={styles.th} onClick={() => handleSort('utm_campaign')}>
                utm_campaign{sortIndicator('utm_campaign')}
              </th>
              <th style={styles.th} onClick={() => handleSort('page_count')}>
                PV数{sortIndicator('page_count')}
              </th>
              <th style={styles.th} onClick={() => handleSort('is_bounce')}>
                直帰{sortIndicator('is_bounce')}
              </th>
              <th style={styles.th} onClick={() => handleSort('duration_seconds')}>
                滞在時間{sortIndicator('duration_seconds')}
              </th>
              <th style={styles.th} onClick={() => handleSort('device_type')}>
                デバイス{sortIndicator('device_type')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="10" style={styles.noData}>
                  読み込み中...
                </td>
              </tr>
            ) : filteredSessions.length === 0 ? (
              <tr>
                <td colSpan="10" style={styles.noData}>
                  データなし
                </td>
              </tr>
            ) : (
              filteredSessions.map((session, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>
                    {new Date(session.started_at).toLocaleString('ja-JP')}
                  </td>
                  <td style={styles.td}>{truncateId(session.visitor_id)}</td>
                  <td style={styles.td}>
                    {(session.landing_page || '-').substring(0, 40)}
                  </td>
                  <td style={styles.td}>{session.utm_source || '-'}</td>
                  <td style={styles.td}>{session.utm_medium || '-'}</td>
                  <td style={styles.td}>{session.utm_campaign || '-'}</td>
                  <td style={styles.td}>{session.page_count || 0}</td>
                  <td style={styles.td}>
                    {session.is_bounce ? 'はい' : 'いいえ'}
                  </td>
                  <td style={styles.td}>
                    {Math.round(session.duration_seconds || 0)}秒
                  </td>
                  <td style={styles.td}>{session.device_type || '-'}</td>
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
    maxWidth: '1400px',
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
  toolbar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    backgroundColor: 'white',
    padding: '15px',
    borderRadius: '4px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    flex: 1,
    minWidth: '200px',
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
  count: {
    fontSize: '12px',
    color: '#666',
    marginLeft: 'auto',
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
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '12px',
    fontSize: '13px',
    borderBottom: '1px solid #eee',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  noData: {
    textAlign: 'center',
    padding: '40px',
    color: '#999',
    fontSize: '14px',
  },
};
