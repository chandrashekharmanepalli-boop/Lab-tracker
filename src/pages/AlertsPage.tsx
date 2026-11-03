import { useState } from 'react';
import { Bell, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import type { UnauthorizedAlert } from '../types/database';
import { formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';
import { useLabData } from '../contexts/LabDataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function AlertsPage() {
  const { alerts, refresh } = useLabData();
  const { profile } = useAuth();
  const [selected, setSelected] = useState<UnauthorizedAlert | null>(null);

  const unack = alerts.filter(a => !a.acknowledged);
  const ack   = alerts.filter(a => a.acknowledged);

  const acknowledge = async (id: string) => {
    if (!profile) return;
    const acknowledgedAt = new Date().toISOString();
    const { error } = await supabase
      .from('unauthorized_alerts')
      .update({ acknowledged: true, acknowledged_at: acknowledgedAt, acknowledged_by: profile.id })
      .eq('id', id);
    if (error) {
      toast.error(`Could not acknowledge alert: ${error.message}`);
      return;
    }
    await refresh();
    toast.success('Alert acknowledged');
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, acknowledged: true, acknowledged_at: acknowledgedAt, acknowledged_by: profile.id } : null);
    }
  };

  const acknowledgeAll = async () => {
    if (!profile) return;
    const { error } = await supabase
      .from('unauthorized_alerts')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString(), acknowledged_by: profile.id })
      .eq('acknowledged', false);
    if (error) {
      toast.error(`Could not acknowledge alerts: ${error.message}`);
      return;
    }
    await refresh();
    setSelected(null);
    toast.success('All alerts acknowledged');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Unauthorized Alerts</h1>
          <p className="page-subtitle">{unack.length} unacknowledged · {alerts.length} total</p>
        </div>
        <div className="page-actions">
          {unack.length > 0 && (
            <button id="ack-all-btn" className="btn btn-secondary btn-sm" onClick={acknowledgeAll}>
              <CheckCircle size={14} /> Acknowledge All
            </button>
          )}
        </div>
      </div>

      {unack.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span><strong>{unack.length} active alert{unack.length > 1 ? 's' : ''}</strong> — Unauthorized instruments detected at gate. Review and acknowledge.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 420px' : '1fr', gap: 20 }}>
        {/* Alert list */}
        <div>
          {[...unack, ...ack].map(alert => (
            <div
              key={alert.id}
              onClick={() => setSelected(alert)}
              style={{
                background: 'white',
                border: `1.5px solid ${alert.acknowledged ? 'var(--gray-200)' : 'var(--danger-400)'}`,
                borderRadius: 12, padding: 16, marginBottom: 12, cursor: 'pointer',
                transition: 'all 0.2s',
                opacity: alert.acknowledged ? 0.75 : 1,
                boxShadow: selected?.id === alert.id ? '0 0 0 2px var(--blue-500)' : 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  background: alert.acknowledged ? 'var(--gray-100)' : 'var(--danger-100)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {alert.acknowledged
                    ? <CheckCircle size={18} color="var(--gray-400)" />
                    : <AlertTriangle size={18} color="var(--danger-500)" />}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem', color: alert.acknowledged ? 'var(--gray-500)' : 'var(--gray-900)' }}>
                      {alert.instrument?.name ?? 'Unknown Instrument'}
                    </span>
                    <span className={`badge ${alert.acknowledged ? 'returned' : 'unauthorized'}`}>
                      {alert.acknowledged ? 'Acknowledged' : 'UNAUTHORIZED'}
                    </span>
                    <span className={`badge ${alert.severity === 'high' ? 'missing' : alert.severity === 'medium' ? 'repair' : 'borrowed'}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                    Instrument detected at exit gate — no active borrowing record found.
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 4 }}>
                    {formatDateTime(alert.created_at)}
                    {alert.instrument && <span> · ID: {alert.instrument.instrument_id}</span>}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost btn-icon btn-sm" title="View" onClick={e => { e.stopPropagation(); setSelected(alert); }}><Eye size={14} /></button>
                  {!alert.acknowledged && (
                    <button
                      id={`ack-btn-${alert.id}`}
                      className="btn btn-success btn-sm"
                      onClick={e => { e.stopPropagation(); acknowledge(alert.id); }}
                    >
                      <CheckCircle size={13} /> Ack
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="empty-state card" style={{ padding: 48 }}>
              <Bell size={48} className="empty-state-icon" />
              <h3>No alerts</h3>
              <p>All gate events are authorized. The system will notify you of any unauthorized movements.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-header">
              <p className="card-title">Alert Detail</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: selected.acknowledged ? 'var(--gray-50)' : 'var(--danger-100)', borderRadius: 8, padding: 16, textAlign: 'center' }}>
                <AlertTriangle size={28} color={selected.acknowledged ? 'var(--gray-400)' : 'var(--danger-500)'} style={{ margin: '0 auto 8px' }} />
                <p style={{ fontWeight: 700, color: selected.acknowledged ? 'var(--gray-600)' : 'var(--danger-600)' }}>
                  {selected.acknowledged ? 'Acknowledged' : 'UNAUTHORIZED MOVEMENT'}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Instrument',  selected.instrument?.name ?? '—'],
                  ['Instrument ID', selected.instrument?.instrument_id ?? '—'],
                  ['Severity',    selected.severity.toUpperCase()],
                  ['Event Time',  formatDateTime(selected.created_at)],
                  ['Gate Event',  selected.gate_event_id],
                  ['Status',      selected.acknowledged ? 'Acknowledged' : 'Pending'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-800)', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>

              {!selected.acknowledged && (
                <button
                  id={`detail-ack-btn-${selected.id}`}
                  className="btn btn-success"
                  style={{ width: '100%' }}
                  onClick={() => acknowledge(selected.id)}
                >
                  <CheckCircle size={16} /> Acknowledge Alert
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
