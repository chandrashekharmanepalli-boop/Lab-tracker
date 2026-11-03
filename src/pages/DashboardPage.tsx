import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Package, Users, ArrowLeftRight, Wrench, AlertTriangle,
  CheckCircle, Activity, Cpu, Clock, TrendingUp, TrendingDown, ArrowRight,
} from 'lucide-react';
import { formatTimeAgo } from '../lib/utils';
import { useLabData } from '../contexts/LabDataContext';
import { useAuth } from '../contexts/AuthContext';
import { isStale } from '../lib/utils';
import { readLabHours, WEEKDAYS } from '../lib/labHours';

interface ActivityItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  icon: 'checkout' | 'return' | 'alert' | 'device' | 'weight';
  color: string;
  bg: string;
}

export default function DashboardPage() {
  const { instruments, students, transactions, alerts, devices, weightReadings, components, settings, auditLogs, maintenanceRecords, gateEvents } = useLabData();
  const { role, profile } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const today = new Date().toDateString();
  const total = instruments.length;
  const available = instruments.filter(item => item.status === 'available').length;
  const borrowed = instruments.filter(item => item.status === 'borrowed').length;
  const repair = instruments.filter(item => item.status === 'repair').length;
  const missing = instruments.filter(item => item.status === 'missing').length;
  const overdueCount = transactions.filter(item => item.status !== 'returned' && new Date(item.expected_return) < currentTime).length;
  const activeStudents = students.filter(student => student.is_active).length;
  const alertCount = alerts.filter(alert => !alert.acknowledged).length;
  const onlineDevices = devices.filter(device => device.status === 'online' && !isStale(device.last_heartbeat, 61_000)).length;
  const issuedToday = transactions.filter(item => new Date(item.issue_date).toDateString() === today).length;
  const returnedToday = transactions.filter(item => item.returned_at && new Date(item.returned_at).toDateString() === today).length;
  const lowStockCount = components.filter(component => component.current_quantity <= component.low_stock_threshold).length;
  const generalSettings = settings.find(setting => setting.key === 'general')?.value;
  const labHours = typeof generalSettings === 'object' && generalSettings !== null && !Array.isArray(generalSettings)
    ? readLabHours((generalSettings as Record<string, unknown>).labHours)
    : null;
  const weekday = WEEKDAYS[(currentTime.getDay() + 6) % 7];
  const todayHours = labHours?.[weekday.key];
  const timeNow = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isLabOpen = Boolean(todayHours?.open)
    && timeNow >= Number(todayHours?.opens.slice(0, 2)) * 60 + Number(todayHours?.opens.slice(3))
    && timeNow < Number(todayHours?.closes.slice(0, 2)) * 60 + Number(todayHours?.closes.slice(3));

  const dailyStats = Array.from({ length: 14 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (13 - index));
    const key = day.toDateString();
    return {
      date: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      issued: transactions.filter(item => new Date(item.issue_date).toDateString() === key).length,
      returned: transactions.filter(item => item.returned_at && new Date(item.returned_at).toDateString() === key).length,
    };
  });

  const activityFeed: ActivityItem[] = [
    ...transactions.map(item => ({
      id: `transaction-${item.id}`,
      title: item.status === 'returned' ? 'Instrument returned' : 'Instrument issued',
      desc: `${item.instrument?.name ?? 'Instrument'} · ${item.student?.name ?? 'Student'}`,
      time: item.returned_at ?? item.issue_date,
      icon: item.status === 'returned' ? 'return' as const : 'checkout' as const,
      color: item.status === 'returned' ? '#22c55e' : '#3b82f6',
      bg: item.status === 'returned' ? '#dcfce7' : '#dbeafe',
    })),
    ...alerts.map(item => ({
      id: `alert-${item.id}`,
      title: item.acknowledged ? 'Alert acknowledged' : 'Unauthorized movement',
      desc: item.instrument?.name ?? 'Unknown instrument',
      time: item.created_at,
      icon: 'alert' as const,
      color: '#ef4444',
      bg: '#fee2e2',
    })),
    ...devices.filter(item => item.last_heartbeat).map(item => ({
      id: `device-${item.id}`,
      title: 'Device heartbeat',
      desc: item.name,
      time: item.last_heartbeat!,
      icon: 'device' as const,
      color: '#f59e0b',
      bg: '#fef3c7',
    })),
    ...weightReadings.map(item => ({
      id: `weight-${item.id}`,
      title: 'Weight reading recorded',
      desc: `${item.component?.name ?? 'Component'} · ${item.net_weight_g}g`,
      time: item.timestamp,
      icon: 'weight' as const,
      color: '#8b5cf6',
      bg: '#ede9fe',
    })),
    ...auditLogs.filter(log => ['component_stock', 'instruments', 'maintenance_records', 'gate_events'].includes(log.table_name)).map(log => {
      const component = components.find(item => item.id === log.record_id);
      const instrument = instruments.find(item => item.id === log.record_id);
      const maintenance = maintenanceRecords.find(item => item.id === log.record_id);
      const gateEvent = gateEvents.find(item => item.id === log.record_id);
      const values = log.new_values ?? log.old_values;
      const itemName = typeof values?.name === 'string' ? values.name : 'Lab record';
      const title = log.table_name === 'component_stock'
        ? `${component?.name ?? itemName} stock updated`
        : log.table_name === 'instruments'
          ? `${instrument?.name ?? itemName} ${log.action.toLowerCase()}`
          : log.table_name === 'maintenance_records'
            ? 'Instrument maintenance recorded'
            : `Gate event ${gateEvent?.direction ?? 'recorded'}`;
      const desc = log.table_name === 'component_stock'
        ? `${component?.current_quantity ?? '—'} in stock`
        : log.table_name === 'instruments'
          ? `${instrument?.instrument_id ?? ''} · ${instrument?.status ?? ''}`
          : log.table_name === 'maintenance_records'
            ? `${maintenance?.instrument?.name ?? 'Instrument'} · ${maintenance?.description ?? ''}`
            : `${gateEvent?.instrument?.name ?? 'Unknown instrument'} · ${gateEvent?.authorized ? 'authorized' : 'unauthorized'}`;
      return {
        id: `audit-${log.id}`,
        title,
        desc,
        time: log.timestamp,
        icon: (log.table_name === 'component_stock' ? 'weight' : log.table_name === 'gate_events' ? 'device' : 'checkout') as ActivityItem['icon'],
        color: '#8b5cf6',
        bg: '#ede9fe',
      };
    }),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 8);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">
          {role === 'admin' ? 'Admin Dashboard' : role === 'faculty' ? 'Faculty Dashboard' : 'Lab Assistant Dashboard'}
        </h1>
        <p className="page-subtitle">Welcome, {profile?.full_name}. Live lab inventory, component stock, checkouts, and notifications.</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="live-indicator"><span className="live-dot" />Live database</div>
        <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)' }}>
          {currentTime.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' })}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--gray-400)' }}>
          {onlineDevices}/{devices.length} devices online
        </span>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <StatCard label="Total Instruments" value={total} icon={<Package size={20} />} iconClass="blue" variant="info" change="Registered inventory" trend="neutral" />
        <StatCard label="Available" value={available} icon={<CheckCircle size={20} />} iconClass="green" variant="success" change="Ready to issue" trend="neutral" />
        <StatCard label="Currently Borrowed" value={borrowed} icon={<ArrowLeftRight size={20} />} iconClass="blue" variant="info" change={`${overdueCount} overdue`} trend={overdueCount ? 'down' : 'neutral'} />
        <StatCard label="Under Repair" value={repair} icon={<Wrench size={20} />} iconClass="yellow" variant="warning" change="Maintenance" trend="neutral" />
        <StatCard label="Missing" value={missing} icon={<AlertTriangle size={20} />} iconClass="red" variant="danger" change="Unaccounted" trend="down" />
        <StatCard label="Active Students" value={activeStudents} icon={<Users size={20} />} iconClass="navy" variant="info" change="Registered students" trend="neutral" />
        <StatCard label="Components Low" value={lowStockCount} icon={<Activity size={20} />} iconClass="yellow" variant="warning" change="At or below threshold" trend={lowStockCount ? 'down' : 'neutral'} />
        <StatCard label="Issued Today" value={issuedToday} icon={<TrendingUp size={20} />} iconClass="green" variant="success" change="Database records" trend="neutral" />
        <StatCard label="Returned Today" value={returnedToday} icon={<TrendingDown size={20} />} iconClass="blue" variant="info" change="Database records" trend="neutral" />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <p className="card-title">Lab Hours · {weekday.label}</p>
            <p className="card-subtitle">{labHours ? todayHours?.open ? `${todayHours.opens}–${todayHours.closes}` : 'Closed today' : 'Hours have not been set by an administrator yet'}</p>
          </div>
          {labHours && todayHours?.open && (
            <span className={`badge ${isLabOpen ? 'available' : 'offline'}`}>{isLabOpen ? 'Open now' : 'Closed now'}</span>
          )}
        </div>
        {lowStockCount > 0 && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--warning-700)' }}>
              {lowStockCount} component{lowStockCount === 1 ? '' : 's'} need restocking: {components.filter(component => component.current_quantity <= component.low_stock_threshold).slice(0, 5).map(component => `${component.name} (${component.current_quantity})`).join(', ')}
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <p className="card-title">Daily Transactions</p>
              <p className="card-subtitle">Issues and returns — last 14 days</p>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="gIssued" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gReturned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                <Area type="monotone" dataKey="issued" stroke="#3b82f6" strokeWidth={2} fill="url(#gIssued)" name="Issued" />
                <Area type="monotone" dataKey="returned" stroke="#22c55e" strokeWidth={2} fill="url(#gReturned)" name="Returned" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <p className="card-title">Live Activity Feed</p>
            <Activity size={16} color="var(--gray-400)" />
          </div>
          <div className="card-body" style={{ padding: '0 20px' }}>
            <div className="activity-feed">
              {activityFeed.map(item => (
                <div className="activity-item" key={item.id}>
                  <div className="activity-icon" style={{ background: item.bg, color: item.color }}>
                    {item.icon === 'checkout' && <ArrowRight size={14} />}
                    {item.icon === 'return' && <CheckCircle size={14} />}
                    {item.icon === 'alert' && <AlertTriangle size={14} />}
                    {item.icon === 'device' && <Cpu size={14} />}
                    {item.icon === 'weight' && <Activity size={14} />}
                  </div>
                  <div className="activity-content">
                    <p className="activity-title">{item.title}</p>
                    <p className="activity-desc">{item.desc}</p>
                    <p className="activity-time">{formatTimeAgo(item.time)}</p>
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && <p className="empty-state">No activity recorded yet.</p>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header"><p className="card-title">Instrument Status Summary</p></div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { name: 'Available', count: available },
                { name: 'Borrowed', count: borrowed },
                { name: 'Repair', count: repair },
                { name: 'Missing', count: missing },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--gray-400)' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <p className="card-title">Hardware Device Status</p>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{onlineDevices}/{devices.length} online</span>
          </div>
          <div className="card-body" style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {devices.map(device => {
              const online = device.status === 'online' && !isStale(device.last_heartbeat, 61_000);
              return (
                <div key={device.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--success-500)' : 'var(--danger-500)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-800)' }}>{device.name}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontFamily: 'var(--font-mono)' }}>{device.device_id}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                    <span className={`badge ${online ? 'online' : 'offline'}`}>{online ? 'online' : 'offline'}</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>
                      <Clock size={9} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} />
                      {formatTimeAgo(device.last_heartbeat)}
                    </span>
                  </div>
                </div>
              );
            })}
            {devices.length === 0 && <p className="empty-state">No hardware devices registered.</p>}
          </div>
        </div>
      </div>

      {alertCount > 0 && (
        <div className="alert alert-danger" style={{ marginTop: 20 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>{alertCount} unacknowledged unauthorized movement alert{alertCount > 1 ? 's' : ''}</strong> — Go to <a href="/alerts" style={{ textDecoration: 'underline' }}>Alerts</a> to review.
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, iconClass, variant, change, trend,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconClass: string;
  variant: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className={`stat-card ${variant}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className={`stat-icon-wrap ${iconClass}`}>{icon}</div>
      </div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      <div className={`stat-change ${trend}`}>
        {trend === 'up' && <TrendingUp size={12} />}
        {trend === 'down' && <TrendingDown size={12} />}
        <span>{change}</span>
      </div>
    </div>
  );
}
