import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowLeftRight, Package, Search, Weight } from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { useLabData } from '../contexts/LabDataContext';
import type { AuditLog } from '../types/database';

type ActivityFilter = 'All' | 'Checkouts' | 'Components' | 'Alerts' | 'Inventory' | 'Hardware';
type ActivityEntry = {
  id: string;
  category: Exclude<ActivityFilter, 'All'>;
  title: string;
  detail: string;
  time: string;
  actor: string;
};

const FILTERS: ActivityFilter[] = ['All', 'Checkouts', 'Components', 'Alerts', 'Inventory', 'Hardware'];

function valueAt(value: Record<string, unknown> | null, key: string): string | null {
  const result = value?.[key];
  if (typeof result === 'string' || typeof result === 'number') return String(result);
  return null;
}

function describeLog(
  log: AuditLog,
  data: ReturnType<typeof useLabData>,
): ActivityEntry {
  const transaction = data.transactions.find(item => item.id === log.record_id);
  const instrument = data.instruments.find(item => item.id === log.record_id);
  const component = data.components.find(item => item.id === log.record_id);
  const alert = data.alerts.find(item => item.id === log.record_id);
  const reading = data.weightReadings.find(item => item.id === log.record_id);
  const maintenance = data.maintenanceRecords.find(item => item.id === log.record_id);
  const device = data.devices.find(item => item.id === log.record_id);
  const profile = data.profiles.find(item => item.id === log.user_id);
  const action = log.action.toLowerCase();
  const verb = action === 'insert' ? 'added' : action === 'delete' ? 'removed' : 'updated';
  const table = log.table_name;
  const actor = profile?.full_name ?? (log.user_id ? `Account ${log.user_id.slice(0, 8)}` : 'System');

  if (table === 'checkout_transactions') {
    const returned = valueAt(log.new_values, 'status') === 'returned'
      || (valueAt(log.old_values, 'status') !== 'returned' && Boolean(valueAt(log.new_values, 'returned_at')));
    const title = returned ? 'Instrument returned' : action === 'insert' ? 'Instrument checked out' : 'Checkout updated';
    const detail = transaction
      ? `${transaction.instrument?.name ?? 'Instrument'} · ${transaction.student?.name ?? 'Student'} · expected ${formatDateTime(transaction.expected_return)}`
      : `Checkout record ${log.record_id ?? ''}`;
    return { id: log.id, category: 'Checkouts', title, detail, time: log.timestamp, actor };
  }

  if (table === 'component_stock') {
    const oldQuantity = valueAt(log.old_values, 'current_quantity');
    const newQuantity = valueAt(log.new_values, 'current_quantity');
    const quantityChange = oldQuantity !== null && newQuantity !== null
      ? ` · quantity ${oldQuantity} → ${newQuantity}`
      : '';
    return {
      id: log.id,
      category: 'Components',
      title: `${component?.name ?? valueAt(log.new_values, 'name') ?? 'Component'} ${verb}`,
      detail: `${component?.category ?? valueAt(log.new_values, 'category') ?? 'Component stock'}${quantityChange}`,
      time: log.timestamp,
      actor,
    };
  }

  if (table === 'weight_readings') {
    return {
      id: log.id,
      category: 'Components',
      title: 'Component weight recorded',
      detail: reading
        ? `${reading.component?.name ?? 'Component'} · ${reading.net_weight_g} g${reading.estimated_quantity === null ? '' : ` · about ${reading.estimated_quantity} units`}`
        : 'A component weight reading was recorded',
      time: log.timestamp,
      actor,
    };
  }

  if (table === 'unauthorized_alerts') {
    return {
      id: log.id,
      category: 'Alerts',
      title: alert?.acknowledged ? 'Security alert acknowledged' : 'Unauthorized movement alert',
      detail: `${alert?.instrument?.name ?? 'Unknown instrument'} · ${(alert?.severity ?? valueAt(log.new_values, 'severity') ?? 'unknown').toUpperCase()} severity`,
      time: log.timestamp,
      actor,
    };
  }

  if (table === 'instruments') {
    return {
      id: log.id,
      category: 'Inventory',
      title: `${instrument?.name ?? valueAt(log.new_values, 'name') ?? 'Instrument'} ${verb}`,
      detail: instrument ? `${instrument.instrument_id} · ${instrument.status}` : `Instrument record ${log.record_id ?? ''}`,
      time: log.timestamp,
      actor,
    };
  }

  if (table === 'maintenance_records') {
    return {
      id: log.id,
      category: 'Inventory',
      title: 'Maintenance recorded',
      detail: `${maintenance?.instrument?.name ?? 'Instrument'} · ${maintenance?.description ?? valueAt(log.new_values, 'description') ?? ''}`,
      time: log.timestamp,
      actor,
    };
  }

  const category: ActivityEntry['category'] = table === 'hardware_devices' || table === 'gate_events'
    ? 'Hardware'
    : 'Inventory';
  const displayTable = table.replace(/_/g, ' ');
  const displayName = valueAt(log.new_values, 'name') ?? valueAt(log.old_values, 'name');
  const detail = table === 'hardware_devices' && device
    ? `${device.name} · ${device.status}`
    : displayName ?? `${displayTable} record ${log.record_id ?? ''}`;
  return {
    id: log.id,
    category,
    title: `${displayTable.charAt(0).toUpperCase()}${displayTable.slice(1)} ${verb}`,
    detail,
    time: log.timestamp,
    actor,
  };
}

export default function LabActivityPage() {
  const data = useLabData();
  const [filter, setFilter] = useState<ActivityFilter>('All');
  const [search, setSearch] = useState('');

  const entries = useMemo(
    () => data.auditLogs.map(log => describeLog(log, data)).sort((a, b) => Date.parse(b.time) - Date.parse(a.time)),
    [data],
  );
  const filtered = entries.filter(entry => {
    const query = search.trim().toLowerCase();
    return (filter === 'All' || entry.category === filter)
      && (!query || `${entry.title} ${entry.detail} ${entry.actor}`.toLowerCase().includes(query));
  }).slice(0, 100);
  const lowStock = data.components.filter(component => component.current_quantity <= component.low_stock_threshold);
  const activeCheckouts = data.transactions.filter(transaction => transaction.status !== 'returned');
  const activeAlerts = data.alerts.filter(alert => !alert.acknowledged);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Lab Activity</h1>
          <p className="page-subtitle">Live record of checkouts, component changes, alerts, and inventory updates.</p>
        </div>
        <span className="live-indicator"><span className="live-dot" />Live database</span>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <ActivityStat icon={<ArrowLeftRight size={19} />} label="Items currently borrowed" value={activeCheckouts.length} />
        <ActivityStat icon={<Package size={19} />} label="Components at low stock" value={lowStock.length} />
        <ActivityStat icon={<AlertTriangle size={19} />} label="Unacknowledged alerts" value={activeAlerts.length} />
        <ActivityStat icon={<Activity size={19} />} label="Audit records" value={data.auditLogs.length} />
      </div>

      {lowStock.length > 0 && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <Package size={16} style={{ flexShrink: 0 }} />
          <span>
            <strong>Restock notice:</strong> {lowStock.slice(0, 6).map(component => `${component.name} (${component.current_quantity} left)`).join(' · ')}
            {lowStock.length > 6 ? ` · and ${lowStock.length - 6} more` : ''}
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div>
            <p className="card-title">Component Stock</p>
            <p className="card-subtitle">Current quantities and restock thresholds</p>
          </div>
          <Weight size={17} color="var(--gray-400)" />
        </div>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Component</th><th>Category</th><th>Location</th><th>In stock</th><th>Threshold</th><th>Status</th></tr></thead>
            <tbody>
              {data.components.map(component => {
                const isLow = component.current_quantity <= component.low_stock_threshold;
                return (
                  <tr key={component.id}>
                    <td>{component.name}</td>
                    <td>{component.category}</td>
                    <td>{component.location ?? '—'}</td>
                    <td>{component.current_quantity}</td>
                    <td>{component.low_stock_threshold}</td>
                    <td><span className={`badge ${isLow ? 'repair' : 'available'}`}>{isLow ? 'Restock needed' : 'In stock'}</span></td>
                  </tr>
                );
              })}
              {data.components.length === 0 && <tr><td colSpan={6}><p className="empty-state">No component stock records yet.</p></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <p className="card-title">Activity & Notifications</p>
            <p className="card-subtitle">Showing {filtered.length} of {entries.length} events, newest first</p>
          </div>
        </div>
        <div className="card-body">
          <div className="toolbar" style={{ marginTop: 0 }}>
            <div className="toolbar-left">
              <div className="search-input-wrap">
                <Search size={16} className="search-icon" />
                <input
                  type="search"
                  className="search-input"
                  aria-label="Search lab activity"
                  placeholder="Search events, items, or people…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="toolbar-right">
              <select aria-label="Filter lab activity" className="filter-select" value={filter} onChange={event => setFilter(event.target.value as ActivityFilter)}>
                {FILTERS.map(value => <option key={value} value={value}>{value === 'All' ? 'All activity' : value}</option>)}
              </select>
            </div>
          </div>
          <div className="activity-feed">
            {filtered.map(entry => (
              <div className="activity-item" key={entry.id}>
                <div className="activity-icon" style={{ background: entry.category === 'Alerts' ? 'var(--danger-100)' : 'var(--info-100)', color: entry.category === 'Alerts' ? 'var(--danger-500)' : 'var(--blue-500)' }}>
                  {entry.category === 'Alerts' ? <AlertTriangle size={14} /> : entry.category === 'Checkouts' ? <ArrowLeftRight size={14} /> : <Activity size={14} />}
                </div>
                <div className="activity-content">
                  <p className="activity-title">{entry.title}</p>
                  <p className="activity-desc">{entry.detail}</p>
                  <p className="activity-time">{formatDateTime(entry.time)} · {entry.actor} · {entry.category}</p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="empty-state">No matching lab activity found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="stat-card info">
      <div className="stat-icon-wrap blue">{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}
