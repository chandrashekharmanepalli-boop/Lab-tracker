import { useState } from 'react';
import { Weight, AlertTriangle, TrendingDown } from 'lucide-react';
import { formatDateTime } from '../lib/utils';
import { useLabData } from '../contexts/LabDataContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function WeighingPage() {
  const { components, weightReadings } = useLabData();
  const [selectedId, setSelectedId] = useState('');
  const selectedComp = components.find(component => component.id === selectedId) ?? components[0] ?? null;
  const selectedReadings = weightReadings.filter(reading => !selectedComp || reading.component_id === selectedComp.id);
  const latestReading = selectedReadings[0] ?? null;
  const lowStock = components.filter(component => component.current_quantity <= component.low_stock_threshold);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Weighing Station</h1>
          <p className="page-subtitle">Live scale readings and electronic component stock</p>
        </div>
        <div className="page-actions">
          {lowStock.length > 0 && <span className="badge repair"><TrendingDown size={11} /> {lowStock.length} Low Stock</span>}
        </div>
      </div>

      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
        <Weight size={14} style={{ flexShrink: 0 }} />
        <span>Readings are taken from the live database. An ESP32 + HX711 scale and a secured ingestion service are required to send physical sensor readings.</span>
      </div>

      {lowStock.length > 0 && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span><strong>Low Stock:</strong> {lowStock.map(component => component.name).join(', ')} — please reorder.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header">
              <p className="card-title">Latest Weight Reading</p>
              <span className={`badge ${latestReading ? 'online' : 'offline'}`}>{latestReading ? 'Live data' : 'No readings'}</span>
            </div>
            <div className="card-body">
              <div className="weight-display">
                <div className="weight-value">
                  {latestReading ? latestReading.net_weight_g.toFixed(1) : '—'}
                  <span className="weight-unit">g</span>
                </div>
                <p className="weight-status">
                  {latestReading?.estimated_quantity !== null && latestReading?.estimated_quantity !== undefined
                    ? `≈ ${latestReading.estimated_quantity} pcs estimated`
                    : latestReading ? 'No quantity estimate for this reading' : 'Waiting for a device reading'}
                </p>
                {latestReading && <p style={{ marginTop: 8, color: 'var(--gray-400)', fontSize: '0.75rem' }}>{formatDateTime(latestReading.timestamp)}</p>}
              </div>

              <div style={{ marginTop: 20 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>Component</p>
                <select
                  id="component-select"
                  className="form-control"
                  value={selectedComp?.id ?? ''}
                  onChange={event => setSelectedId(event.target.value)}
                >
                  <option value="">All components</option>
                  {components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {selectedComp && (
            <div className="card">
              <div className="card-header"><p className="card-title">Calibration Data</p></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  ['Component', selectedComp.name],
                  ['Category', selectedComp.category],
                  ['Unit Weight', selectedComp.unit_weight_g ? `${selectedComp.unit_weight_g}g` : 'Not set'],
                  ['Per 100g', selectedComp.quantity_per_100g ? `${selectedComp.quantity_per_100g} pcs` : '—'],
                  ['Current Stock', `${selectedComp.current_quantity} pcs`],
                  ['Low Threshold', `${selectedComp.low_stock_threshold} pcs`],
                  ['Location', selectedComp.location ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-100)' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{label}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-800)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card">
            <div className="card-header"><p className="card-title">Component Stock</p></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Component</th><th>Category</th><th>Qty</th><th>Threshold</th><th>Status</th></tr></thead>
                <tbody>
                  {components.map(component => {
                    const isLow = component.current_quantity <= component.low_stock_threshold;
                    return (
                      <tr key={component.id} onClick={() => setSelectedId(component.id)} style={{ cursor: 'pointer' }}>
                        <td style={{ fontWeight: 500, fontSize: '0.8rem' }}>{component.name}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{component.category}</td>
                        <td style={{ fontWeight: 700, color: isLow ? 'var(--danger-500)' : 'var(--gray-800)', fontSize: '0.875rem' }}>{component.current_quantity}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{component.low_stock_threshold}</td>
                        <td><span className={`badge ${isLow ? 'missing' : 'available'}`}>{isLow ? 'Low' : 'OK'}</span></td>
                      </tr>
                    );
                  })}
                  {components.length === 0 && <tr><td colSpan={5}>No component stock records.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <p className="card-title">Weight Readings History</p>
              <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{selectedReadings.length} readings</span>
            </div>
            <div className="card-body" style={{ paddingTop: 8 }}>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={selectedReadings.slice().reverse().map(reading => ({ ...reading, ts: new Date(reading.timestamp).getTime() }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-100)" />
                  <XAxis dataKey="ts" tickFormatter={value => new Date(Number(value)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} labelFormatter={value => new Date(Number(value)).toLocaleString()} />
                  <Line type="monotone" dataKey="net_weight_g" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Net Weight (g)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Component</th><th>Net (g)</th><th>Est. Qty</th><th>Time</th></tr></thead>
                <tbody>
                  {selectedReadings.map(reading => (
                    <tr key={reading.id}>
                      <td style={{ fontSize: '0.8rem' }}>{reading.component?.name ?? reading.component_id ?? '—'}</td>
                      <td style={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{reading.net_weight_g.toFixed(1)}</td>
                      <td style={{ fontSize: '0.875rem', fontWeight: 600 }}>{reading.estimated_quantity ?? '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{formatDateTime(reading.timestamp)}</td>
                    </tr>
                  ))}
                  {selectedReadings.length === 0 && <tr><td colSpan={4}>No weight readings have been received.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
