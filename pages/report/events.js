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

export default function EventsReport() {
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState(getDefaultDates().startDate);
  const [endDate, setEndDate] = useState(getDefaultDates().endDate);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [error, setError] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortField, setSortField] = useState('count');
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
        `/api/report?type=events&site_id=${siteId}&start=${startDate}&end=${endDate}`
      );
      if (!res.ok) throw new Error('Events fetch failed');
      const data = await res.json();
      setEvents(data || []);
      setFilteredEvents(data || []);
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
    let filtered = events.filter((event) => {
      const searchLower = searchText.toLowerCase();
      return (event.event_name || '').toLowerCase().includes(searchLower);
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

    setFilteredEvents(filtered);
  }, [searchText, sortField, sortDir, events]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleExport = () => {
    const headers = ['イベント名', '発生件数', 'ユニーク訪問者', 'ユニークセッション'];

    const rows = filteredEvents.map((event) => [
      event.event_name || '-',
      event.count || 0,
      event.unique_visitors || 0,
      event.unique_sessions || 0,
    ]);

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    downloadCsv(csv, 'events.csv');
  };

  const handleDateChange = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const sortIndicator = (field) => {
    if (sortField !== field) return ' ⇅';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <Layout title="イベント">
      <div style={styles.container}>
        <h1 style={styles.title}>イベント</h1>

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
          {filteredEvents.length}件
        </span>
      </div>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead style={styles.tableHead}>
            <tr>
              <th style={styles.th} onClick={() => handleSort('event_name')}>
                イベント名{sortIndicator('event_name')}
              </th>
              <th style={styles.th} onClick={() => handleSort('count')}>
                発生件数{sortIndicator('count')}
              </th>
              <th style={styles.th} onClick={() => handleSort('unique_visitors')}>
                ユニーク訪問者{sortIndicator('unique_visitors')}
              </th>
              <th style={styles.th} onClick={() => handleSort('unique_sessions')}>
                ユニークセッション{sortIndicator('unique_sessions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={styles.noData}>
                  読み込み中...
                </td>
              </tr>
            ) : filteredEvents.length === 0 ? (
              <tr>
                <td colSpan="4" style={styles.noData}>
                  データなし
                </td>
              </tr>
            ) : (
              filteredEvents.map((event, idx) => (
                <tr key={idx}>
                  <td style={styles.td}>{event.event_name || '-'}</td>
                  <td style={styles.td}>{event.count || 0}</td>
                  <td style={styles.td}>{event.unique_visitors || 0}</td>
                  <td style={styles.td}>{event.unique_sessions || 0}</td>
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
