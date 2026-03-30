import { useState } from 'react';

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  loading = false,
  onRefresh,
}) {
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const getPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  };

  const getTodayPreset = () => {
    const today = new Date().toISOString().split('T')[0];
    return { start: today, end: today };
  };

  const getYesterdayPreset = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const date = yesterday.toISOString().split('T')[0];
    return { start: date, end: date };
  };

  const handlePreset = (preset) => {
    onChange(preset.start, preset.end);
    setShowCustom(false);
  };

  const handleCustomApply = () => {
    onChange(customStart, customEnd);
    setShowCustom(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <div style={styles.label}>期間:</div>
        <div style={styles.dateDisplay}>
          {formatDate(startDate)} 〜 {formatDate(endDate)}
        </div>

        <div style={styles.presets}>
          <button
            style={styles.presetBtn}
            onClick={() => handlePreset(getTodayPreset())}
          >
            今日
          </button>
          <button
            style={styles.presetBtn}
            onClick={() => handlePreset(getYesterdayPreset())}
          >
            昨日
          </button>
          <button
            style={styles.presetBtn}
            onClick={() => handlePreset(getPreset(7))}
          >
            過去7日
          </button>
          <button
            style={styles.presetBtn}
            onClick={() => handlePreset(getPreset(28))}
          >
            過去28日
          </button>
          <button
            style={styles.presetBtn}
            onClick={() => handlePreset(getPreset(90))}
          >
            過去90日
          </button>
          <button
            style={styles.presetBtn}
            onClick={() => {
              setCustomStart(startDate);
              setCustomEnd(endDate);
              setShowCustom(!showCustom);
            }}
          >
            カスタム
          </button>
        </div>

        {showCustom && (
          <div style={styles.customPicker}>
            <div style={styles.customRow}>
              <label style={styles.customLabel}>開始日:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.customRow}>
              <label style={styles.customLabel}>終了日:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={styles.input}
              />
            </div>
            <div style={styles.customButtons}>
              <button
                style={styles.applyBtn}
                onClick={handleCustomApply}
                disabled={loading}
              >
                適用
              </button>
              <button
                style={styles.cancelBtn}
                onClick={() => setShowCustom(false)}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        style={{ ...styles.refreshBtn, opacity: loading ? 0.6 : 1 }}
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? '更新中...' : '更新'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: '15px 20px',
    borderRadius: '4px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    gap: '20px',
    flexWrap: 'wrap',
  },
  content: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flex: 1,
    minWidth: '300px',
    flexWrap: 'wrap',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#333',
  },
  dateDisplay: {
    fontSize: '14px',
    color: '#666',
    minWidth: '200px',
  },
  presets: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  presetBtn: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#333',
    transition: 'all 0.2s ease',
  },
  presetBtnHover: {
    backgroundColor: '#1a8fc1',
    color: 'white',
    borderColor: '#1a8fc1',
  },
  customPicker: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-end',
    backgroundColor: '#f9f9f9',
    padding: '10px',
    borderRadius: '4px',
    width: '100%',
    flexWrap: 'wrap',
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  customLabel: {
    fontSize: '12px',
    color: '#666',
  },
  input: {
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '12px',
  },
  customButtons: {
    display: 'flex',
    gap: '8px',
  },
  applyBtn: {
    padding: '6px 12px',
    backgroundColor: '#1a8fc1',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  cancelBtn: {
    padding: '6px 12px',
    backgroundColor: '#f0f0f0',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  refreshBtn: {
    padding: '8px 16px',
    backgroundColor: '#1a8fc1',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'opacity 0.2s ease',
  },
};
