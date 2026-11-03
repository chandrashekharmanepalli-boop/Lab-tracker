import { useState } from 'react';
import { Download, Calendar, Filter } from 'lucide-react';
import { formatDate, formatDateTime, isOverdue } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useLabData } from '../contexts/LabDataContext';

const TABS = ['Transactions', 'Overdue', 'Alerts', 'Inventory', 'Device Uptime'] as const;
type Tab = typeof TABS[number];

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function ReportsPage() {
  const { transactions, alerts, devices, instruments } = useLabData();
  const [activeTab, setActiveTab] = useState<Tab>('Transactions');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]   = useState('');

  const filteredTransactions = transactions.filter(transaction => {
    const issued = new Date(transaction.issue_date).toISOString().slice(0, 10);
    return (!dateFrom || issued >= dateFrom) && (!dateTo || issued <= dateTo);
  });

  const exportCSV = (filename: string, rows: string[][]) => {
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportTransactions = () => {
    const rows = [
      ['Student', 'Roll No', 'Instrument', 'Instrument ID', 'Issued', 'Expected Return', 'Returned', 'Status'],
      ...filteredTransactions.map(t => [
        t.student?.name ?? '', t.student?.roll_no ?? '',
        t.instrument?.name ?? '', t.instrument?.instrument_id ?? '',
        formatDateTime(t.issue_date), formatDate(t.expected_return),
        t.returned_at ? formatDateTime(t.returned_at) : 'Not returned', t.status,
      ]),
    ];
    exportCSV('lab-transactions.csv', rows);
  };

  const statusData = [
    { name: 'Available', value: instruments.filter(i => i.status === 'available').length },
    { name: 'Borrowed',  value: instruments.filter(i => i.status === 'borrowed').length },
    { name: 'Repair',    value: instruments.filter(i => i.status === 'repair').length },
    { name: 'Missing',   value: instruments.filter(i => i.status === 'missing').length },
  ];

  const categoryData = Object.entries(
    instruments.reduce<Record<string, number>>((acc, i) => {
      acc[i.category] = (acc[i.category] ?? 0) + 1; return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Analytics and exports from live lab records</p>
        </div>
        <div className="page-actions">
          <button id="export-csv-btn" className="btn btn-secondary" onClick={exportTransactions}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* Date filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Calendar size={16} color="var(--gray-400)" />
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0 }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>From</label>
              <input id="rpt-from" type="date" className="form-control" style={{ width: 'auto' }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, margin: 0 }}>
              <label className="form-label" style={{ whiteSpace: 'nowrap', marginBottom: 0 }}>To</label>
              <input id="rpt-to" type="date" className="form-control" style={{ width: 'auto' }} value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
              <Filter size={13} /> Clear
            </button>
            <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--gray-400)' }}>Showing {filteredTransactions.length} live transaction records</span>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header"><p className="card-title">Instrument Status</p></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><p className="card-title">Instruments by Category</p></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TABS.map(t => (
          <button key={t} id={`rpt-tab-${t.toLowerCase().replace(/\s+/g, '-')}`} className={`tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>{t}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Transactions' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Student</th><th>Instrument</th><th>Issued</th><th>Expected Return</th><th>Status</th></tr></thead>
              <tbody>
                {filteredTransactions.map(t => (
                  <tr key={t.id}>
                    <td><div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t.student?.name}</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{t.student?.roll_no}</div></td>
                    <td><div>{t.instrument?.name}</div><div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>{t.instrument?.instrument_id}</div></td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDate(t.issue_date)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDate(t.expected_return)}</td>
                    <td><span className={`badge ${t.status}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Overdue' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Student</th><th>Instrument</th><th>Expected Return</th><th>Days Overdue</th></tr></thead>
              <tbody>
                {filteredTransactions.filter(t => t.status !== 'returned' && isOverdue(t.expected_return)).map(t => {
                  const days = Math.floor((Date.now() - new Date(t.expected_return).getTime()) / 86400000);
                  return (
                    <tr key={t.id}>
                      <td><div style={{ fontWeight: 600 }}>{t.student?.name}</div><div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{t.student?.roll_no}</div></td>
                      <td>{t.instrument?.name}</td>
                      <td style={{ color: 'var(--danger-500)', fontWeight: 600 }}>{formatDate(t.expected_return)}</td>
                      <td><span className="badge missing">{days} day{days !== 1 ? 's' : ''}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Alerts' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Instrument</th><th>Severity</th><th>Time</th><th>Status</th></tr></thead>
              <tbody>
                {alerts.filter(alert => {
                  const date = new Date(alert.created_at).toISOString().slice(0, 10);
                  return (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
                }).map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.instrument?.name ?? '—'}</td>
                    <td><span className={`badge ${a.severity === 'high' ? 'missing' : 'repair'}`}>{a.severity}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDateTime(a.created_at)}</td>
                    <td><span className={`badge ${a.acknowledged ? 'returned' : 'unauthorized'}`}>{a.acknowledged ? 'Acknowledged' : 'Pending'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Inventory' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Instrument</th><th>ID</th><th>Category</th><th>Location</th><th>Status</th><th>Condition</th></tr></thead>
              <tbody>
                {instruments.map(i => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.875rem' }}>{i.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{i.instrument_id}</td>
                    <td style={{ fontSize: '0.8rem' }}>{i.category}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{i.location}</td>
                    <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                    <td style={{ fontSize: '0.8rem', textTransform: 'capitalize' }}>{i.condition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Device Uptime' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Device</th><th>ID</th><th>Type</th><th>Status</th><th>Last Heartbeat</th><th>Last Event</th></tr></thead>
              <tbody>
                {devices.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{d.device_id}</td>
                    <td style={{ fontSize: '0.8rem' }}>{d.type}</td>
                    <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDateTime(d.last_heartbeat)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDateTime(d.last_event)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
