import { useState, useMemo } from 'react';
import { Plus, Search, CheckCircle, AlertCircle, ArrowLeftRight, CreditCard, Package } from 'lucide-react';
import type { Student, Instrument } from '../types/database';
import { formatDate, formatDateTime, isOverdue } from '../lib/utils';
import toast from 'react-hot-toast';
import { useLabData } from '../contexts/LabDataContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function TransactionsPage() {
  const { transactions, students, instruments, refresh } = useLabData();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'checkout' | 'history'>('checkout');
  const [search, setSearch] = useState('');
  const [showIssueModal, setShowIssueModal] = useState(false);

  const active = useMemo(() => transactions.filter(t => t.status !== 'returned'), [transactions]);
  const history = useMemo(() => transactions.filter(t => t.status === 'returned'), [transactions]);
  const displayList = activeTab === 'checkout' ? active : history;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return displayList.filter(t =>
      !q ||
      (t.student?.name ?? '').toLowerCase().includes(q) ||
      (t.instrument?.name ?? '').toLowerCase().includes(q) ||
      (t.instrument?.instrument_id ?? '').toLowerCase().includes(q)
    );
  }, [displayList, search]);

  const handleReturn = async (txId: string) => {
    const { error } = await supabase.rpc('return_instrument', { p_transaction_id: txId });
    if (error) {
      toast.error(`Could not return instrument: ${error.message}`);
      return;
    }
    await refresh();
    toast.success('Instrument returned successfully');
  };

  const handleIssue = async (studentId: string, instrumentId: string, expectedReturn: string) => {
    const student    = students.find(s => s.id === studentId);
    const instrument = instruments.find(i => i.id === instrumentId);

    if (!student || !instrument) { toast.error('Student or instrument not found'); return; }
    if (instrument.status !== 'available') { toast.error('Instrument is not available'); return; }
    if (!profile) { toast.error('Sign in before issuing an instrument'); return; }
    const { error } = await supabase.rpc('issue_instrument', {
      p_student_id: studentId,
      p_instrument_id: instrumentId,
      p_expected_return: new Date(`${expectedReturn}T23:59:59`).toISOString(),
    });
    if (error) {
      toast.error(`Could not issue instrument: ${error.message}`);
      return;
    }

    await refresh();
    toast.success(`${instrument.name} issued to ${student.name}`);
    setShowIssueModal(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Checkout / Return</h1>
          <p className="page-subtitle">{active.length} active loans · {transactions.filter(t => t.status === 'overdue').length} overdue</p>
        </div>
        <div className="page-actions">
          <button id="issue-instrument-btn" className="btn btn-primary" onClick={() => setShowIssueModal(true)}>
            <Plus size={16} /> Issue Instrument
          </button>
        </div>
      </div>

      {/* Hardware notice */}
      <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
        <CreditCard size={14} style={{ flexShrink: 0 }} />
        <span>
          <strong>Hardware Integration:</strong> When an RC522 RFID reader and UHF reader are physically connected, checkout events are triggered automatically via the hardware API.
          This manual form is for lab staff fallback only.
        </span>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button id="tab-active" className={`tab-btn ${activeTab === 'checkout' ? 'active' : ''}`} onClick={() => setActiveTab('checkout')}>
          Active Loans ({active.length})
        </button>
        <button id="tab-history" className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          History ({history.length})
        </button>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input id="txn-search" type="text" className="search-input" placeholder="Search student or instrument…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Instrument</th>
                <th>Issued On</th>
                <th>Expected Return</th>
                <th>Return Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><ArrowLeftRight size={40} className="empty-state-icon" /><h3>No transactions</h3></div></td></tr>
              ) : filtered.map(tx => {
                const overdue = tx.status !== 'returned' && isOverdue(tx.expected_return);
                return (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{tx.student?.name ?? '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{tx.student?.roll_no ?? ''}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{tx.instrument?.name ?? '—'}</div>
                      <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--gray-400)' }}>{tx.instrument?.instrument_id ?? ''}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{formatDateTime(tx.issue_date)}</td>
                    <td style={{ fontSize: '0.8rem', color: overdue ? 'var(--danger-500)' : 'var(--gray-600)', fontWeight: overdue ? 600 : 400 }}>
                      {formatDate(tx.expected_return)}
                      {overdue && <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--danger-500)', fontWeight: 600 }}>⚠ OVERDUE</span>}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{tx.returned_at ? formatDateTime(tx.returned_at) : '—'}</td>
                    <td>
                      <span className={`badge ${overdue && tx.status !== 'returned' ? 'overdue' : tx.status}`}>
                        <span className="badge-dot" />
                        {overdue && tx.status !== 'returned' ? 'overdue' : tx.status}
                      </span>
                    </td>
                    <td>
                      {tx.status !== 'returned' && (
                        <button
                          id={`return-btn-${tx.id}`}
                          className="btn btn-success btn-sm"
                          onClick={() => handleReturn(tx.id)}
                        >
                          <CheckCircle size={13} /> Return
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showIssueModal && (
        <IssueModal
          students={students}
          instruments={instruments.filter(i => i.status === 'available')}
          onIssue={handleIssue}
          onClose={() => setShowIssueModal(false)}
        />
      )}
    </div>
  );
}

function IssueModal({
  students, instruments, onIssue, onClose
}: {
  students: Student[]; instruments: Instrument[];
  onIssue: (s: string, i: string, ret: string) => Promise<void>;
  onClose: () => void;
}) {
  const [studentId,     setStudentId]     = useState('');
  const [instrumentId,  setInstrumentId]  = useState('');
  const [expectedReturn, setExpected]      = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [saving, setSaving] = useState(false);

  const submitIssue = async () => {
    setSaving(true);
    try {
      await onIssue(studentId, instrumentId, expectedReturn);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Issue Instrument</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            Manual checkout — use hardware RFID scan when available.
          </div>
          <div className="form-group">
            <label className="form-label required">Select Student</label>
            <select id="issue-student" className="form-control" value={studentId} onChange={e => setStudentId(e.target.value)}>
              <option value="">— Select a student —</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.roll_no})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Select Instrument</label>
            <select id="issue-instrument" className="form-control" value={instrumentId} onChange={e => setInstrumentId(e.target.value)}>
              <option value="">— Select an available instrument —</option>
              {instruments.map(i => <option key={i.id} value={i.id}>{i.name} ({i.instrument_id})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label required">Expected Return Date</label>
            <input id="issue-return-date" type="date" className="form-control" value={expectedReturn} onChange={e => setExpected(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="confirm-issue-btn"
            type="button"
            className="btn btn-primary"
            disabled={!studentId || !instrumentId || saving}
            onClick={() => void submitIssue()}
          >
            <Package size={15} /> {saving ? 'Issuing…' : 'Issue Instrument'}
          </button>
        </div>
      </div>
    </div>
  );
}
