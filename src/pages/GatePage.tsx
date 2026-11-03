import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Activity, Shield } from 'lucide-react';
import { formatDateTime, formatTimeAgo, isStale } from '../lib/utils';
import { useLabData } from '../contexts/LabDataContext';

export default function GatePage() {
  const { gateEvents, devices } = useLabData();
  const [now, setNow] = useState(Date.now());
  const latestEvent = gateEvents[0];

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const eventIsRecent = !!latestEvent && now - new Date(latestEvent.timestamp).getTime() < 10_000;
  const sensor1 = eventIsRecent && latestEvent.sensor1_triggered;
  const sensor2 = eventIsRecent && latestEvent.sensor2_triggered;
  const gateDevice = devices.find(device =>
    device.type === 'rfid_gate' && device.status === 'online' && !isStale(device.last_heartbeat, 61_000)
  );
  const eventColor = eventIsRecent
    ? latestEvent.authorized ? 'var(--success-500)' : 'var(--danger-500)'
    : 'var(--gray-300)';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Gate Monitor</h1>
          <p className="page-subtitle">Live exit gate events and RFID anti-theft monitoring</p>
        </div>
        <div className="page-actions">
          {gateDevice
            ? <span className="badge online"><span className="badge-dot" />{gateDevice.name} Online</span>
            : <span className="badge offline"><span className="badge-dot" />Gate Controller Offline</span>}
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
        <Shield size={14} style={{ flexShrink: 0 }} />
        <span>
          Gate readings on this page are real database events. Physical sensors require an ESP32 device and a secured server-side ingestion service; neither is included in this web app.
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card">
          <div className="card-header">
            <p className="card-title">Latest Gate Status</p>
            {eventIsRecent && <div className="live-indicator"><span className="live-dot" />Live event</div>}
          </div>
          <div className="card-body">
            <div className="gate-visual">
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%', justifyContent: 'center' }}>
                <Sensor label="Outside" name="Sensor 1" triggered={sensor1} />
                <div style={{ textAlign: 'center', padding: '0 12px' }}>
                  <div style={{
                    width: 60, height: 80, border: `3px solid ${eventColor}`, borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: eventIsRecent ? (latestEvent.authorized ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') : 'transparent',
                  }}>
                    <Shield size={24} color={eventColor} />
                  </div>
                  <p style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Gate</p>
                </div>
                <Sensor label="Inside" name="Sensor 2" triggered={sensor2} />
              </div>
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {sensor1 && !sensor2 && <p style={{ color: 'var(--warning-500)', fontWeight: 600 }}>Movement detected — waiting for second sensor…</p>}
                {sensor1 && sensor2 && (
                  <p style={{ color: latestEvent.authorized ? 'var(--success-500)' : 'var(--danger-500)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ArrowRight size={16} />{latestEvent.authorized ? 'Authorized exit' : 'Unauthorized exit'}
                  </p>
                )}
                {!sensor1 && !sensor2 && <p style={{ color: 'var(--gray-400)' }}>Waiting for live gate sensor events</p>}
                {latestEvent && <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 6 }}>Last event {formatTimeAgo(latestEvent.timestamp)}</p>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header"><p className="card-title">Gate Controller Device</p></div>
            <div className="card-body">
              {gateDevice ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <DeviceValue label="Device ID" value={gateDevice.device_id} />
                  <DeviceValue label="Status" value="Online" />
                  <DeviceValue label="IP Address" value={gateDevice.ip_address ?? '—'} />
                  <DeviceValue label="Wi-Fi RSSI" value={gateDevice.wifi_rssi === null ? '—' : `${gateDevice.wifi_rssi} dBm`} />
                  <DeviceValue label="Firmware" value={gateDevice.firmware_version ?? '—'} />
                  <DeviceValue label="Last Heartbeat" value={formatTimeAgo(gateDevice.last_heartbeat)} />
                </div>
              ) : (
                <div className="alert alert-danger"><AlertTriangle size={14} /> Gate controller is offline or not registered.</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <p className="card-title">Recent Gate Events</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{gateEvents.length} events</span>
            </div>
            <div className="card-body" style={{ padding: '8px 16px' }}>
              {gateEvents.map(event => (
                <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: event.authorized ? 'var(--success-100)' : 'var(--danger-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {event.direction === 'exit'
                      ? <ArrowRight size={13} color={event.authorized ? 'var(--success-500)' : 'var(--danger-500)'} />
                      : <ArrowLeft size={13} color={event.authorized ? 'var(--success-500)' : 'var(--danger-500)'} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-800)' }}>
                      {event.instrument?.name ?? event.rfid_uid ?? 'Unknown RFID'} · {event.authorized ? 'Authorized' : 'UNAUTHORIZED'}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{formatDateTime(event.timestamp)}</p>
                  </div>
                </div>
              ))}
              {gateEvents.length === 0 && <p className="empty-state">No gate events have been received.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sensor({ label, name, triggered }: { label: string; name: string; triggered: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase' }}>{label}</p>
      <div className={`sensor-circle ${triggered ? 'triggered' : ''}`}>
        <Activity size={22} color={triggered ? 'var(--success-500)' : 'var(--gray-300)'} />
      </div>
      <p style={{ marginTop: 8, fontSize: '0.75rem', fontWeight: 600, color: triggered ? 'var(--success-500)' : 'var(--gray-400)' }}>{name}</p>
    </div>
  );
}

function DeviceValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--gray-400)', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-800)' }}>{value}</p>
    </div>
  );
}
