import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Archive, Package, Filter } from 'lucide-react';
import type { Instrument, InstrumentStatus } from '../types/database';
import { formatDate } from '../lib/utils';
import InstrumentModal from '../components/InstrumentModal';
import { useLabData } from '../contexts/LabDataContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All Status' },
  { value: 'available', label: 'Available' },
  { value: 'borrowed',  label: 'Borrowed' },
  { value: 'repair',    label: 'Under Repair' },
  { value: 'missing',   label: 'Missing' },
  { value: 'archived',  label: 'Archived' },
];

const CAT_OPTS = ['All Categories', 'Test & Measurement', 'Measurement', 'Tools', 'Power', 'RF & Communications'];

export default function InstrumentsPage() {
  const { instruments, refresh } = useLabData();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter] = useState('All Categories');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Instrument | null>(null);

  const filtered = useMemo(() => {
    return instruments.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !q || i.name.toLowerCase().includes(q) || i.instrument_id.toLowerCase().includes(q) || (i.rfid_uid ?? '').toLowerCase().includes(q);
      const matchStatus = !statusFilter || i.status === statusFilter;
      const matchCat    = catFilter === 'All Categories' || i.category === catFilter;
      return matchSearch && matchStatus && matchCat;
    });
  }, [instruments, search, statusFilter, catFilter]);

  const handleSave = async (inst: Instrument) => {
    const { id, created_at: _createdAt, updated_at: _updatedAt, ...values } = inst;
    const result = editTarget
      ? await supabase.from('instruments').update(values).eq('id', id).select('id').single()
      : await supabase.from('instruments').insert(values).select('id').single();

    if (result.error) {
      toast.error(`Could not save instrument: ${result.error.message}`);
      return;
    }

    await refresh();
    toast.success(editTarget ? 'Instrument updated' : 'Instrument added');
    setModalOpen(false);
    setEditTarget(null);
  };

  const archiveInstrument = async (instrument: Instrument) => {
    const { error } = await supabase
      .from('instruments')
      .update({ status: 'archived' })
      .eq('id', instrument.id);
    if (error) {
      toast.error(`Could not archive instrument: ${error.message}`);
      return;
    }
    await refresh();
    toast.success('Instrument archived');
  };

  const openEdit = (inst: Instrument) => { setEditTarget(inst); setModalOpen(true); };
  const openAdd  = () => { setEditTarget(null); setModalOpen(true); };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Instruments</h1>
          <p className="page-subtitle">{instruments.length} instruments registered • {instruments.filter(i => i.status === 'available').length} available</p>
        </div>
        <div className="page-actions">
          <button id="add-instrument-btn" className="btn btn-primary" onClick={openAdd}>
            <Plus size={16} /> Add Instrument
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              id="instrument-search"
              type="text"
              className="search-input"
              placeholder="Search by name, ID, or RFID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select id="status-filter" className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select id="cat-filter" className="filter-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            {CAT_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="toolbar-right">
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
            <Filter size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            {filtered.length} of {instruments.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>ID</th>
                <th>RFID Tag</th>
                <th>Category</th>
                <th>Location</th>
                <th>Status</th>
                <th>Condition</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <Package size={40} className="empty-state-icon" />
                      <h3>No instruments found</h3>
                      <p>Try adjusting your search or filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(inst => (
                  <tr key={inst.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--gray-900)', fontSize: '0.875rem' }}>{inst.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{inst.description ?? ''}</div>
                    </td>
                    <td><span className="font-mono" style={{ fontSize: '0.8rem', background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{inst.instrument_id}</span></td>
                    <td><span className="font-mono" style={{ fontSize: '0.75rem', color: inst.rfid_uid ? 'var(--gray-700)' : 'var(--gray-400)' }}>{inst.rfid_uid ?? '—'}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{inst.category}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{inst.location}</td>
                    <td><StatusBadge status={inst.status} /></td>
                    <td><span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{inst.condition}</span></td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{formatDate(inst.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => openEdit(inst)}><Edit2 size={14} /></button>
                        {inst.status !== 'archived' && (
                          <button className="btn btn-ghost btn-icon btn-sm" title="Archive" style={{ color: 'var(--gray-400)' }} onClick={() => void archiveInstrument(inst)}><Archive size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <InstrumentModal
          instrument={editTarget}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          existingIds={instruments.map(i => i.instrument_id)}
          existingRfids={instruments.filter(i => i.id !== editTarget?.id).map(i => i.rfid_uid).filter(Boolean) as string[]}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: InstrumentStatus }) {
  return <span className={`badge ${status}`}><span className="badge-dot" />{status}</span>;
}
