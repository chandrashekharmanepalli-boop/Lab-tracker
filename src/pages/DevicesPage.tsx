import { useEffect, useState } from 'react';
import { Cpu, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatTimeAgo } from '../lib/utils';
import { useLabData } from '../contexts/LabDataContext';

const TYPE_LABELS: Record<string, string> = {
  rfid_gate: 'RFID Gate Controller',
  inventory_rfid: 'Inventory RFID Reader',
  weighing_station: 'Weighing Station',
  multi: 'Multi-purpose',
};

export default function DevicesPage() {
  const { devices } = useLabData();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const isOnline = (lastHeartbeat: string | null, status: string) =>
    status === 'online' && !!lastHeartbeat && now - new Date(lastHeartbeat).getTime() <= 61_000;
  const onlineCount = devices.filter(device => isOnline(device.last_heartbeat, device.status)).length;
  const offlineCount = devices.length - onlineCount;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Device Monitor</h1>
          <p className="page-subtitle">ESP32 hardware status & heartbeat monitoring</p>
        </div>
        <div className="page-actions" style={{ gap: 8 }}>
          <span className="badge online"><span className="badge-dot" /> {onlineCount} Online</span>
          {offlineCount > 0 && <span className="badge offline"><span className="badge-dot" /> {offlineCount} Offline</span>}
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 20, fontSize: '0.8rem' }}>
        <Cpu size={14} style={{ flexShrink: 0 }} />
        <span>
          Device status and heartbeats shown here come from the connected database. Physical ESP32 hardware needs a secured server-side ingestion endpoint and firmware before it can send live readings.
          Never put a Supabase service-role key in the browser or device firmware.
        </span>
      </div>

      {devices.length === 0 ? (
        <div className="empty-state card" style={{ padding: 48 }}>
          <Cpu size={40} className="empty-state-icon" />
          <h3>No devices registered</h3>
          <p>Register a device in the Supabase hardware_devices table to monitor its live status.</p>
        </div>
      ) : <div className="device-grid">
        {devices.map(dev => {
          const online = isOnline(dev.last_heartbeat, dev.status);
          const stale = !online;
          return (
            <div key={dev.id} className={`card device-card ${online ? 'online' : 'offline'}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <p className="device-name">{dev.name}</p>
                  <p className="device-id">{dev.device_id}</p>
                  <p style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginTop: 2 }}>{TYPE_LABELS[dev.type] ?? dev.type}</p>
                </div>
                <span className={`badge ${online ? 'online' : 'offline'}`} style={{ flexShrink: 0 }}>
                  <span className="badge-dot" />{online ? 'Online' : 'Offline'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <StatChip label="Location" value={dev.location} />
                <StatChip label="Firmware" value={dev.firmware_version ?? '—'} mono />
                <StatChip label="IP Address" value={dev.ip_address ?? '—'} mono />
                <StatChip label="Wi-Fi RSSI" value={dev.wifi_rssi ? `${dev.wifi_rssi} dBm` : '—'} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <Clock size={12} color="var(--gray-400)" />
                  <span style={{ color: 'var(--gray-500)' }}>Last heartbeat:</span>
                  <span style={{ fontWeight: 600, color: stale ? 'var(--danger-500)' : 'var(--success-500)' }}>
                    {formatTimeAgo(dev.last_heartbeat)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
                  <CheckCircle size={12} color="var(--gray-400)" />
                  <span style={{ color: 'var(--gray-500)' }}>Last event:</span>
                  <span style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{formatTimeAgo(dev.last_event)}</span>
                </div>
              </div>

              {dev.error_message && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'var(--danger-100)', borderRadius: 6, fontSize: '0.75rem', color: '#991b1b' }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0 }} />
                  {dev.error_message}
                </div>
              )}

            </div>
          );
        })}
      </div>}
    </div>
  );
}

function StatChip({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--gray-50)', borderRadius: 6, padding: '6px 8px' }}>
      <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--gray-400)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gray-700)', fontFamily: mono ? 'var(--font-mono)' : 'inherit', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  );
}
