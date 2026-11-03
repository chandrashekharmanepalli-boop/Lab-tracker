import { useState } from 'react';
import { X } from 'lucide-react';
import type { Instrument, InstrumentStatus, InstrumentCondition } from '../types/database';

interface Props {
  instrument: Instrument | null;
  onSave: (i: Instrument) => void;
  onClose: () => void;
  existingIds: string[];
  existingRfids: string[];
}

const STATUS_OPTS: InstrumentStatus[] = ['available', 'borrowed', 'repair', 'missing', 'archived'];
const COND_OPTS:   InstrumentCondition[] = ['excellent', 'good', 'fair', 'poor'];
const CATS = ['Test & Measurement', 'Measurement', 'Tools', 'Power', 'RF & Communications', 'Safety', 'Other'];

function genId() {
  return `INST-${String(Math.floor(Math.random() * 900) + 100).padStart(3, '0')}`;
}

export default function InstrumentModal({ instrument, onSave, onClose, existingIds, existingRfids }: Props) {
  const isEdit = !!instrument;
  const [form, setForm] = useState<Partial<Instrument>>(instrument ?? {
    name: '', instrument_id: genId(), rfid_uid: '', category: CATS[0],
    location: '', description: '', status: 'available', condition: 'good',
    purchase_date: '', purchase_cost: undefined,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = 'Name is required';
    if (!form.instrument_id?.trim()) e.instrument_id = 'ID is required';
    if (!isEdit && existingIds.includes(form.instrument_id ?? '')) e.instrument_id = 'Instrument ID already exists';
    if (form.rfid_uid && existingRfids.includes(form.rfid_uid)) e.rfid_uid = 'RFID UID already assigned';
    if (!form.location?.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const now = new Date().toISOString();
    onSave({
      id: instrument?.id ?? `i_${Math.random().toString(36).slice(2)}`,
      name: form.name!,
      instrument_id: form.instrument_id!,
      rfid_uid: form.rfid_uid || null,
      category: form.category!,
      location: form.location!,
      description: form.description || null,
      status: form.status as InstrumentStatus,
      condition: form.condition as InstrumentCondition,
      purchase_date: form.purchase_date || null,
      purchase_cost: form.purchase_cost ?? null,
      image_url: null,
      created_at: instrument?.created_at ?? now,
      updated_at: now,
    });
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Instrument' : 'Add New Instrument'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label required">Name</label>
                <input id="inst-name" className={`form-control ${errors.name ? 'border-danger' : ''}`} value={form.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="e.g. Digital Oscilloscope" />
                {errors.name && <span className="form-error">{errors.name}</span>}
              </div>
              <div className="form-group">
                <label className="form-label required">Instrument ID</label>
                <input id="inst-id" className={`form-control font-mono ${errors.instrument_id ? 'border-danger' : ''}`} value={form.instrument_id ?? ''} onChange={e => set('instrument_id', e.target.value)} />
                {errors.instrument_id && <span className="form-error">{errors.instrument_id}</span>}
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">RFID Tag UID</label>
                <input id="inst-rfid" className={`form-control font-mono ${errors.rfid_uid ? 'border-danger' : ''}`} value={form.rfid_uid ?? ''} onChange={e => set('rfid_uid', e.target.value)} placeholder="e.g. RF001AAA" />
                {errors.rfid_uid && <span className="form-error">{errors.rfid_uid}</span>}
                <span className="form-hint">Leave blank if no RFID tag assigned yet.</span>
              </div>
              <div className="form-group">
                <label className="form-label required">Category</label>
                <select id="inst-category" className="form-control" value={form.category ?? CATS[0]} onChange={e => set('category', e.target.value)}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label required">Location</label>
              <input id="inst-location" className={`form-control ${errors.location ? 'border-danger' : ''}`} value={form.location ?? ''} onChange={e => set('location', e.target.value)} placeholder="e.g. Lab A - Bench 1" />
              {errors.location && <span className="form-error">{errors.location}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input id="inst-desc" className="form-control" value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Model, make, specifications…" />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select id="inst-status" className="form-control" value={form.status ?? 'available'} onChange={e => set('status', e.target.value)}>
                  {STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Condition</label>
                <select id="inst-condition" className="form-control" value={form.condition ?? 'good'} onChange={e => set('condition', e.target.value)}>
                  {COND_OPTS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Purchase Date</label>
                <input id="inst-purchase-date" type="date" className="form-control" value={form.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Cost (₹)</label>
                <input id="inst-cost" type="number" className="form-control" value={form.purchase_cost ?? ''} onChange={e => set('purchase_cost', Number(e.target.value))} placeholder="0" min={0} />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button id="save-instrument-btn" type="submit" className="btn btn-primary">{isEdit ? 'Save Changes' : 'Add Instrument'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
