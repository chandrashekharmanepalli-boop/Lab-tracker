import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, CreditCard, Users } from 'lucide-react';
import type { Student } from '../types/database';
import { useLabData } from '../contexts/LabDataContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

type StudentFormValues = Pick<Student, 'name' | 'roll_no' | 'department' | 'year' | 'semester' | 'batch' | 'rfid_uid' | 'email' | 'phone'>;

const DEPTS = ['All Departments', 'ENTC', 'Computer', 'Mechanical', 'Civil', 'Electrical'];
const YEARS = ['All Years', '1', '2', '3', '4'];

export default function StudentsPage() {
  const { students, refresh } = useLabData();
  const [search, setSearch]   = useState('');
  const [deptFilter, setDept] = useState('All Departments');
  const [yearFilter, setYear] = useState('All Years');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Student | null>(null);

  const handleSave = async (values: StudentFormValues) => {
    const payload = {
      ...values,
      rfid_uid: values.rfid_uid || null,
      email: values.email || null,
      phone: values.phone || null,
      photo_url: editTarget?.photo_url ?? null,
      is_active: editTarget?.is_active ?? true,
    };
    const result = editTarget
      ? await supabase.from('students').update(payload).eq('id', editTarget.id).select('id').single()
      : await supabase.from('students').insert(payload).select('id').single();

    if (result.error) {
      toast.error(`Could not save student: ${result.error.message}`);
      return;
    }

    await refresh();
    toast.success(editTarget ? 'Student updated' : 'Student added');
    setModalOpen(false);
    setEditTarget(null);
  };

  const filtered = useMemo(() => students.filter(s => {
    const q = search.toLowerCase();
    const matchQ    = !q || s.name.toLowerCase().includes(q) || s.roll_no.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q);
    const matchDept = deptFilter === 'All Departments' || s.department === deptFilter;
    const matchYear = yearFilter === 'All Years'       || String(s.year) === yearFilter;
    return matchQ && matchDept && matchYear;
  }), [students, search, deptFilter, yearFilter]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{students.filter(s => s.is_active).length} active students registered</p>
        </div>
        <div className="page-actions">
          <button id="add-student-btn" className="btn btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
            <Plus size={16} /> Add Student
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input id="student-search" type="text" className="search-input" placeholder="Search name, roll no, email…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select id="dept-filter" className="filter-select" value={deptFilter} onChange={e => setDept(e.target.value)}>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select id="year-filter" className="filter-select" value={yearFilter} onChange={e => setYear(e.target.value)}>
            {YEARS.map(y => <option key={y} value={y}>{y === 'All Years' ? y : `Year ${y}`}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll No</th>
                <th>Department</th>
                <th>Year / Batch</th>
                <th>RFID Card</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <div className="empty-state"><Users size={40} className="empty-state-icon" /><h3>No students found</h3></div>
                </td></tr>
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar" style={{ width: 34, height: 34, fontSize: '0.75rem', flexShrink: 0 }}>
                        {s.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--gray-900)' }}>{s.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>{s.email ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="font-mono" style={{ fontSize: '0.8rem', background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{s.roll_no}</span></td>
                  <td style={{ fontSize: '0.8rem' }}>{s.department}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>Year {s.year}{s.semester ? ` · Sem ${s.semester}` : ''} · {s.batch}</td>
                  <td>
                    {s.rfid_uid
                      ? <span className="font-mono" style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}><CreditCard size={12} color="var(--blue-500)" /> {s.rfid_uid}</span>
                      : <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Not assigned</span>
                    }
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>{s.phone ?? '—'}</td>
                  <td><span className={`badge ${s.is_active ? 'available' : 'archived'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <div className="table-actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Edit" onClick={() => { setEditTarget(s); setModalOpen(true); }}><Edit2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <StudentModal
          student={editTarget}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function StudentModal({ student, onSave, onClose }: { student: Student | null; onSave: (values: StudentFormValues) => void; onClose: () => void }) {
  const isEdit = !!student;
  const [form, setForm] = useState<StudentFormValues>(student ? {
    name: student.name,
    roll_no: student.roll_no,
    department: student.department,
    year: student.year,
    semester: student.semester,
    batch: student.batch,
    rfid_uid: student.rfid_uid ?? '',
    email: student.email ?? '',
    phone: student.phone ?? '',
  } : {
    name: '', roll_no: '', department: 'ENTC', year: 1, semester: null, batch: '2024-28', rfid_uid: '', email: '', phone: '',
  });
  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{isEdit ? 'Edit Student' : 'Add Student'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label required">Full Name</label><input id="stu-name" className="form-control" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label required">Roll Number</label><input id="stu-roll" className="form-control font-mono" value={form.roll_no} onChange={e => set('roll_no', e.target.value)} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Department</label><select id="stu-dept" className="form-control" value={form.department} onChange={e => set('department', e.target.value)}>
              {['ENTC', 'Computer', 'Mechanical', 'Electrical', 'Civil'].map(d => <option key={d}>{d}</option>)}
            </select></div>
            <div className="form-group"><label className="form-label">Year</label><select id="stu-year" className="form-control" value={form.year} onChange={e => set('year', Number(e.target.value))}>
              {[1,2,3,4].map(y => <option key={y} value={y}>Year {y}</option>)}
            </select></div>
          </div>
          <div className="form-group"><label className="form-label">Semester</label><select id="stu-semester" className="form-control" value={form.semester ?? ''} onChange={e => set('semester', e.target.value ? Number(e.target.value) : null)}>
            <option value="">Not set</option>
            {[1,2,3,4,5,6,7,8].map(semester => <option key={semester} value={semester}>Semester {semester}</option>)}
          </select></div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Email</label><input id="stu-email" type="email" className="form-control" value={form.email ?? ''} onChange={e => set('email', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Phone</label><input id="stu-phone" type="tel" className="form-control" value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">RFID Card UID</label>
            <input id="stu-rfid" className="form-control font-mono" value={form.rfid_uid ?? ''} onChange={e => set('rfid_uid', e.target.value)} placeholder="Scan or enter RFID UID" />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button id="save-student-btn" type="button" className="btn btn-primary" onClick={() => void onSave(form)}>{isEdit ? 'Save Changes' : 'Add Student'}</button>
        </div>
      </div>
    </div>
  );
}
