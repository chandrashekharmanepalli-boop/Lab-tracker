import { useCallback, useEffect, useState } from 'react';
import { BookOpen, CalendarDays, ClipboardCheck, Laptop, Megaphone, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type {
  DepartmentAnnouncement, EquipmentBooking, EquipmentDamageReport, Instrument, LabAttendance,
  LabSession, PracticalExperiment, Student, StudentExperiment, StudentExperimentSubmission,
} from '../types/database';
import { formatDate, formatDateTime } from '../lib/utils';
import toast from 'react-hot-toast';

type ManagerTab = 'Experiments & assignments' | 'Attendance' | 'Evaluations' | 'Equipment' | 'Timetable & notices';
type ManagerData = {
  students: Student[];
  instruments: Instrument[];
  experiments: PracticalExperiment[];
  assignments: StudentExperiment[];
  submissions: StudentExperimentSubmission[];
  attendance: LabAttendance[];
  bookings: EquipmentBooking[];
  damageReports: EquipmentDamageReport[];
  sessions: LabSession[];
  announcements: DepartmentAnnouncement[];
};
const EMPTY: ManagerData = { students: [], instruments: [], experiments: [], assignments: [], submissions: [], attendance: [], bookings: [], damageReports: [], sessions: [], announcements: [] };
const TABS: ManagerTab[] = ['Experiments & assignments', 'Attendance', 'Evaluations', 'Equipment', 'Timetable & notices'];

export default function AcademicManagementPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<ManagerTab>('Experiments & assignments');
  const [data, setData] = useState<ManagerData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const results = await Promise.all([
      supabase.from('students').select('*').eq('is_active', true).order('name'),
      supabase.from('instruments').select('*').order('name'),
      supabase.from('practical_experiments').select('*').order('subject').order('experiment_number'),
      supabase.from('student_experiments').select('*').order('assigned_at', { ascending: false }),
      supabase.from('student_experiment_submissions').select('*').order('submitted_at', { ascending: false }),
      supabase.from('lab_attendance').select('*').order('attendance_date', { ascending: false }).limit(200),
      supabase.from('equipment_bookings').select('*').order('requested_at', { ascending: false }).limit(200),
      supabase.from('equipment_damage_reports').select('*').order('reported_at', { ascending: false }).limit(200),
      supabase.from('lab_sessions').select('*').order('starts_at', { ascending: false }).limit(100),
      supabase.from('department_announcements').select('*').order('published_at', { ascending: false }).limit(100),
    ]);
    const failed = results.find(result => result.error);
    if (failed?.error) {
      setLoadError(`Could not load academic management records: ${failed.error.message}`);
      setLoading(false);
      return;
    }
    const [students, instruments, experiments, assignments, submissions, attendance, bookings, damageReports, sessions, announcements] = results;
    setData({
      students: students.data ?? [], instruments: instruments.data ?? [], experiments: experiments.data ?? [], assignments: assignments.data ?? [],
      submissions: submissions.data ?? [], attendance: attendance.data ?? [], bookings: bookings.data ?? [],
      damageReports: damageReports.data ?? [], sessions: sessions.data ?? [], announcements: announcements.data ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return <div className="academic-management">
    <div className="page-header"><div><h1 className="page-title">Academic Management</h1><p className="page-subtitle">Create practicals, record attendance, evaluate submissions, manage equipment, and publish class updates.</p></div><button className="btn btn-secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} /> Refresh</button></div>
    <nav className="academic-tabs" aria-label="Academic management sections">{TABS.map((item, index) => {
      const icons = [BookOpen, CalendarDays, ClipboardCheck, Laptop, Megaphone];
      const Icon = icons[index];
      return <button type="button" className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}><Icon size={16} />{item}</button>;
    })}</nav>
    {loadError && <div className="alert alert-danger" role="alert">{loadError}<button className="btn btn-sm btn-secondary" onClick={() => void refresh()}>Retry</button></div>}
    {loading ? <div className="card"><div className="card-body"><div className="loading-spinner" /></div></div> : <>
      {tab === 'Experiments & assignments' && <ExperimentsSection data={data} profileId={profile?.id ?? null} refresh={refresh} />}
      {tab === 'Attendance' && <AttendanceSection data={data} profileId={profile?.id ?? null} refresh={refresh} />}
      {tab === 'Evaluations' && <EvaluationsSection data={data} refresh={refresh} />}
      {tab === 'Equipment' && <EquipmentSection data={data} profileId={profile?.id ?? null} refresh={refresh} />}
      {tab === 'Timetable & notices' && <ScheduleSection profileId={profile?.id ?? null} refresh={refresh} />}
    </>}
  </div>;
}

function ManagerPanel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="card academic-panel"><header className="academic-panel-header"><div><h2>{title}</h2><p>{description}</p></div></header><div className="card-body">{children}</div></section>;
}

function ExperimentsSection({ data, profileId, refresh }: { data: ManagerData; profileId: string | null; refresh: () => Promise<void> }) {
  const [subject, setSubject] = useState('');
  const [experimentNumber, setExperimentNumber] = useState('');
  const [name, setName] = useState('');
  const [semester, setSemester] = useState('');
  const [instructions, setInstructions] = useState('');
  const [studentId, setStudentId] = useState('');
  const [experimentId, setExperimentId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [reportDueAt, setReportDueAt] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const createExperiment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !experimentNumber.trim() || !name.trim()) { toast.error('Subject, experiment number, and title are required.'); return; }
    setBusy(true);
    const { error } = await supabase.from('practical_experiments').insert({
      subject: subject.trim(), experiment_number: experimentNumber.trim(), name: name.trim(), instructions: instructions.trim(),
      semester: semester ? Number(semester) : null, is_active: true, created_by: profileId,
    });
    if (error) toast.error(`Could not create experiment: ${error.message}`);
    else { toast.success('Practical experiment created.'); setName(''); setExperimentNumber(''); setInstructions(''); await refresh(); }
    setBusy(false);
  };
  const assignExperiment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentId || !experimentId) { toast.error('Choose a student and experiment.'); return; }
    if (dueAt && reportDueAt && new Date(reportDueAt) > new Date(dueAt)) { toast.error('The report deadline should not be later than the practical due date.'); return; }
    setBusy(true);
    const { error } = await supabase.from('student_experiments').insert({
      student_id: studentId, experiment_id: experimentId, assigned_by: profileId,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      report_due_at: reportDueAt ? new Date(reportDueAt).toISOString() : null,
      status: 'pending',
    });
    if (error) toast.error(`Could not assign experiment: ${error.message}`);
    else { toast.success('Experiment assigned.'); setDueAt(''); setReportDueAt(''); await refresh(); }
    setBusy(false);
  };
  const visibleExperiments = data.experiments.filter(item => `${item.subject} ${item.name} ${item.experiment_number}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="academic-grid">
    <ManagerPanel title="Create practical experiment" description="Add an experiment to the catalog for later assignment.">
      <form className="academic-form" onSubmit={createExperiment}>
        <div className="academic-form-grid"><label>Subject<input required maxLength={100} value={subject} onChange={event => setSubject(event.target.value)} placeholder="e.g. Analog Electronics" /></label><label>Experiment number<input required maxLength={30} value={experimentNumber} onChange={event => setExperimentNumber(event.target.value)} placeholder="e.g. 01" /></label></div>
        <label>Experiment title<input required maxLength={180} value={name} onChange={event => setName(event.target.value)} /></label>
        <label>Semester (optional)<select value={semester} onChange={event => setSemester(event.target.value)}><option value="">All semesters</option>{[1,2,3,4,5,6,7,8].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label>Instructions<textarea rows={4} maxLength={8000} value={instructions} onChange={event => setInstructions(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Create experiment</button>
      </form>
    </ManagerPanel>
    <ManagerPanel title="Assign experiment" description="Assign a catalog item to one verified student.">
      <form className="academic-form" onSubmit={assignExperiment}>
        <label>Student<select required value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Select a student</option>{data.students.map(item => <option key={item.id} value={item.id}>{item.name} · {item.roll_no}</option>)}</select></label>
        <label>Experiment<select required value={experimentId} onChange={event => setExperimentId(event.target.value)}><option value="">Select an experiment</option>{data.experiments.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.subject} · #{item.experiment_number} · {item.name}</option>)}</select></label>
        <label>Practical due<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label>
        <label>Report deadline<input type="datetime-local" value={reportDueAt} onChange={event => setReportDueAt(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Assign to student</button>
      </form>
    </ManagerPanel>
    <ManagerPanel title="Experiment catalog" description={`${data.experiments.length} catalog entries`}>
      <div className="academic-search"><Search size={15} /><input placeholder="Filter catalog" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="academic-record-list">{visibleExperiments.map(item => <div key={item.id}><div><strong>{item.subject} · {item.experiment_number} — {item.name}</strong><p>{item.semester ? `Semester ${item.semester}` : 'All semesters'}{item.instructions ? ` · ${item.instructions}` : ''}</p></div><span className={`badge ${item.is_active ? 'available' : 'archived'}`}>{item.is_active ? 'Active' : 'Inactive'}</span></div>)}</div>
      {!visibleExperiments.length && <p className="empty-state">No experiments in the catalog.</p>}
    </ManagerPanel>
  </div>;
}

function AttendanceSection({ data, profileId, refresh }: { data: ManagerData; profileId: string | null; refresh: () => Promise<void> }) {
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [subject, setSubject] = useState('');
  const [status, setStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const saveAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!studentId || !date || !subject.trim()) { toast.error('Select a student, date, and subject.'); return; }
    setBusy(true);
    const { error } = await supabase.from('lab_attendance').upsert({
      student_id: studentId, attendance_date: date, subject: subject.trim(), status, remarks: remarks.trim() || null, recorded_by: profileId,
    }, { onConflict: 'student_id,attendance_date,subject' });
    if (error) toast.error(`Could not save attendance: ${error.message}`);
    else { toast.success('Attendance record saved.'); setRemarks(''); await refresh(); }
    setBusy(false);
  };
  const student = data.students.find(item => item.id === studentId);
  const records = data.attendance.filter(item => !studentId || item.student_id === studentId).slice(0, 50);
  return <div className="academic-grid">
    <ManagerPanel title="Record lab attendance" description="Records are per student, subject, and date. Saving an existing key updates it.">
      <form className="academic-form" onSubmit={saveAttendance}>
        <label>Student<select required value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">Select a student</option>{data.students.map(item => <option key={item.id} value={item.id}>{item.name} · {item.roll_no}</option>)}</select></label>
        {student && <p className="academic-hint">{student.department} · Year {student.year}{student.semester ? ` · Semester ${student.semester}` : ''}</p>}
        <label>Date<input type="date" required value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Subject / practical<input required maxLength={120} value={subject} onChange={event => setSubject(event.target.value)} /></label>
        <label>Status<select value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></select></label>
        <label>Remarks (optional)<textarea rows={2} maxLength={500} value={remarks} onChange={event => setRemarks(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Save attendance</button>
      </form>
    </ManagerPanel>
    <ManagerPanel title="Recent attendance" description="Latest 50 records loaded; use a student filter to narrow the list.">
      <label className="academic-field">Filter student<select value={studentId} onChange={event => setStudentId(event.target.value)}><option value="">All students</option>{data.students.map(item => <option key={item.id} value={item.id}>{item.name} · {item.roll_no}</option>)}</select></label>
      <div className="academic-record-list">{records.map(item => <div key={item.id}><div><strong>{data.students.find(studentItem => studentItem.id === item.student_id)?.name ?? 'Student'} · {item.status}</strong><p>{formatDate(item.attendance_date)} · {item.subject}{item.remarks ? ` · ${item.remarks}` : ''}</p></div><span className="academic-subtle">{data.students.find(studentItem => studentItem.id === item.student_id)?.roll_no ?? ''}</span></div>)}</div>
      {!records.length && <p className="empty-state">No attendance records found.</p>}
    </ManagerPanel>
  </div>;
}

function EvaluationsSection({ data, refresh }: { data: ManagerData; refresh: () => Promise<void> }) {
  const submittedAssignments = [...new Set(data.submissions.map(item => item.assignment_id))];
  const [assignmentId, setAssignmentId] = useState('');
  const [marks, setMarks] = useState('');
  const [maxMarks, setMaxMarks] = useState('100');
  const [remarks, setRemarks] = useState('');
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const choices = data.assignments.filter(item => submittedAssignments.includes(item.id));
  const assignment = choices.find(item => item.id === assignmentId);
  const assignmentSubmissions = data.submissions.filter(item => item.assignment_id === assignmentId);
  const evaluate = async (event: React.FormEvent) => {
    event.preventDefault();
    const numericMarks = Number(marks);
    const numericMax = Number(maxMarks);
    if (!assignmentId || !Number.isFinite(numericMarks) || !Number.isFinite(numericMax) || numericMax <= 0 || numericMarks < 0 || numericMarks > numericMax) {
      toast.error('Enter a valid mark within the maximum score.'); return;
    }
    if (feedbackFile && (feedbackFile.type !== 'application/pdf' || feedbackFile.size > 15 * 1024 * 1024)) {
      toast.error('Evaluated reports must be PDF files no larger than 15 MB.'); return;
    }
    setBusy(true);
    let feedbackPath: string | null = null;
    if (feedbackFile && assignment) {
      const safeName = feedbackFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      feedbackPath = `${assignment.student_id}/${assignment.id}/evaluated/${crypto.randomUUID()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from('student-lab-files').upload(feedbackPath, feedbackFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) { toast.error(`Could not upload evaluated report: ${uploadError.message}`); setBusy(false); return; }
    }
    const { error } = await supabase.rpc('evaluate_student_experiment', {
      p_assignment_id: assignmentId, p_marks: numericMarks, p_max_marks: numericMax, p_remarks: remarks.trim(), p_feedback_file_path: feedbackPath,
    });
    if (error) {
      if (feedbackPath) {
        const { error: cleanupError } = await supabase.storage.from('student-lab-files').remove([feedbackPath]);
        if (cleanupError) toast.error(`Evaluation failed and uploaded report could not be removed: ${cleanupError.message}`);
        else toast.error(`Could not save evaluation: ${error.message}`);
      } else toast.error(`Could not save evaluation: ${error.message}`);
    } else { toast.success('Evaluation saved and experiment marked complete.'); setMarks(''); setRemarks(''); setFeedbackFile(null); await refresh(); }
    setBusy(false);
  };
  return <div className="academic-grid">
    <ManagerPanel title="Evaluate submitted work" description="Evaluation is visible only to the assigned student and lab instructors.">
      <form className="academic-form" onSubmit={evaluate}>
        <label>Submitted experiment<select required value={assignmentId} onChange={event => setAssignmentId(event.target.value)}><option value="">Select a submission</option>{choices.map(item => {
          const student = data.students.find(value => value.id === item.student_id);
          const experiment = data.experiments.find(value => value.id === item.experiment_id);
          return <option key={item.id} value={item.id}>{student?.name ?? 'Student'} · {student?.roll_no ?? ''} · {experiment?.name ?? 'Experiment'}</option>;
        })}</select></label>
        {assignment && <div className="academic-linked-files"><strong>Submitted files</strong>{assignmentSubmissions.map(item => <button type="button" className="academic-file-button" key={item.id} onClick={() => void openSubmission(item.file_path)}>{item.submission_type} · {formatDateTime(item.submitted_at)} · Open file</button>)}</div>}
        <div className="academic-form-grid"><label>Marks<input type="number" min="0" step="0.01" required value={marks} onChange={event => setMarks(event.target.value)} /></label><label>Maximum marks<input type="number" min="0.01" step="0.01" required value={maxMarks} onChange={event => setMaxMarks(event.target.value)} /></label></div>
        <label>Faculty remarks<textarea rows={3} maxLength={2000} value={remarks} onChange={event => setRemarks(event.target.value)} /></label>
        <label>Evaluated report PDF (optional)<input type="file" accept="application/pdf,.pdf" onChange={event => setFeedbackFile(event.target.files?.[0] ?? null)} /><span className="academic-subtle">{feedbackFile?.name ?? 'Students can download this annotated report from their portal.'}</span></label>
        <button className="btn btn-primary" disabled={busy || !assignmentId} type="submit">Save evaluation</button>
      </form>
    </ManagerPanel>
    <ManagerPanel title="Submission queue" description={`${data.submissions.length} submissions available to review.`}>
      <div className="academic-record-list">{data.submissions.slice(0, 50).map(item => {
        const student = data.students.find(value => value.id === item.student_id);
        const assignmentRow = data.assignments.find(value => value.id === item.assignment_id);
        const experiment = data.experiments.find(value => value.id === assignmentRow?.experiment_id);
        return <div key={item.id}><div><strong>{student?.name ?? 'Student'} · {experiment?.name ?? 'Experiment'}</strong><p>{item.submission_type} submitted {formatDateTime(item.submitted_at)}</p></div><button className="btn btn-secondary btn-sm" onClick={() => void openSubmission(item.file_path)}>Open</button></div>;
      })}</div>
      {!data.submissions.length && <p className="empty-state">No student submissions yet.</p>}
    </ManagerPanel>
  </div>;
}

async function openSubmission(path: string) {
  const { data, error } = await supabase.storage.from('student-lab-files').createSignedUrl(path, 60);
  if (error) toast.error(`Could not open submission: ${error.message}`);
  else window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

function EquipmentSection({ data, profileId, refresh }: { data: ManagerData; profileId: string | null; refresh: () => Promise<void> }) {
  const [filter, setFilter] = useState('all');
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const updateBooking = async (booking: EquipmentBooking, status: EquipmentBooking['status']) => {
    setBusyId(booking.id);
    const now = currentTimestamp();
    const patch: Partial<EquipmentBooking> = { status, reviewed_by: profileId, reviewed_at: now };
    if (status === 'issued') patch.issued_at = now;
    if (status === 'returned') patch.returned_at = now;
    const { error } = await supabase.from('equipment_bookings').update(patch).eq('id', booking.id);
    if (error) toast.error(`Could not update equipment request: ${error.message}`);
    else { toast.success(`Equipment request marked ${status}.`); await refresh(); }
    setBusyId(null);
  };
  const allowedTransitions: Record<EquipmentBooking['status'], EquipmentBooking['status'][]> = {
    pending: ['approved', 'rejected', 'cancelled'],
    approved: ['issued', 'rejected', 'cancelled'],
    issued: ['returned'],
    rejected: [],
    returned: [],
    cancelled: [],
  };
  const updateDamage = async (report: EquipmentDamageReport) => {
    setBusyId(report.id);
    const status = resolution[report.id]?.trim() ? 'resolved' : 'reviewing';
    const { error } = await supabase.from('equipment_damage_reports').update({
      status, resolution: resolution[report.id]?.trim() || null, reviewed_by: profileId, reviewed_at: currentTimestamp(),
    }).eq('id', report.id);
    if (error) toast.error(`Could not update damage report: ${error.message}`);
    else { toast.success('Damage report updated.'); await refresh(); }
    setBusyId(null);
  };
  const bookings = data.bookings.filter(item => filter === 'all' || item.status === filter);
  return <div className="academic-grid">
    <ManagerPanel title="Equipment booking requests" description="Approve, reject, issue, or mark requested equipment returned.">
      <label className="academic-field">Filter status<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All requests</option>{['pending','approved','rejected','issued','returned','cancelled'].map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="academic-record-list">{bookings.map(item => <div className="academic-equipment-record" key={item.id}><div><strong>{data.instruments.find(instrument => instrument.id === item.instrument_id)?.name ?? 'Equipment'} · {data.students.find(student => student.id === item.student_id)?.name ?? 'Student'} · {data.students.find(student => student.id === item.student_id)?.roll_no ?? ''}</strong><p>{item.purpose} · needed until {formatDateTime(item.needed_until)}</p><span className="academic-subtle">{item.status} · requested {formatDateTime(item.requested_at)}</span></div><div className="academic-record-actions"><select aria-label="Equipment request status" value={item.status} disabled={busyId === item.id} onChange={event => void updateBooking(item, event.target.value as EquipmentBooking['status'])}><option value={item.status}>{item.status}</option>{allowedTransitions[item.status].map(value => <option key={value} value={value}>{value}</option>)}</select></div></div>)}</div>
      {!bookings.length && <p className="empty-state">No equipment requests for this filter.</p>}
    </ManagerPanel>
    <ManagerPanel title="Equipment damage reports" description="Record review notes or close reports with a resolution.">
      <div className="academic-record-list">{data.damageReports.map(item => <div className="academic-damage-record" key={item.id}><div><strong>{item.instrument_id ? data.instruments.find(instrument => instrument.id === item.instrument_id)?.name ?? 'Equipment' : 'Equipment'} · {data.students.find(student => student.id === item.student_id)?.name ?? 'Student'} · {data.students.find(student => student.id === item.student_id)?.roll_no ?? ''}</strong><p>{item.description}</p><span className="academic-subtle">{item.status} · reported {formatDateTime(item.reported_at)}</span></div><div className="academic-record-actions"><textarea aria-label="Resolution notes" placeholder="Add resolution to close" value={resolution[item.id] ?? item.resolution ?? ''} onChange={event => setResolution(values => ({ ...values, [item.id]: event.target.value }))} /><button className="btn btn-secondary btn-sm" disabled={busyId === item.id} onClick={() => void updateDamage(item)}>{item.status === 'resolved' ? 'Update resolution' : 'Save review'}</button></div></div>)}</div>
      {!data.damageReports.length && <p className="empty-state">No equipment damage reports.</p>}
    </ManagerPanel>
  </div>;
}

function currentTimestamp() {
  return new Date().toISOString();
}

function ScheduleSection({ profileId, refresh }: { profileId: string | null; refresh: () => Promise<void> }) {
  const [subject, setSubject] = useState('');
  const [faculty, setFaculty] = useState('');
  const [laboratory, setLaboratory] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [batch, setBatch] = useState('');
  const [changeNotice, setChangeNotice] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<DepartmentAnnouncement['category']>('general');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const createSession = async (event: React.FormEvent) => {
    event.preventDefault();
    const start = new Date(startsAt); const end = new Date(endsAt);
    if (!subject.trim() || !faculty.trim() || !laboratory.trim() || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      toast.error('Enter a subject, faculty, laboratory, and valid start/end times.'); return;
    }
    setBusy(true);
    const { error } = await supabase.from('lab_sessions').insert({
      subject: subject.trim(), faculty_name: faculty.trim(), laboratory: laboratory.trim(),
      starts_at: start.toISOString(), ends_at: end.toISOString(), department: 'ENTC',
      target_year: year ? Number(year) : null, target_semester: semester ? Number(semester) : null,
      target_batch: batch.trim() || null, change_notice: changeNotice.trim() || null, created_by: profileId,
    });
    if (error) toast.error(`Could not publish session: ${error.message}`);
    else { toast.success('Practical session published.'); setSubject(''); setStartsAt(''); setEndsAt(''); setChangeNotice(''); await refresh(); }
    setBusy(false);
  };
  const publishAnnouncement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) { toast.error('Announcement title and message are required.'); return; }
    const expires = expiresAt ? new Date(expiresAt) : null;
    if (expires && (Number.isNaN(expires.getTime()) || expires <= new Date())) { toast.error('Expiry must be a future date.'); return; }
    setBusy(true);
    const { error } = await supabase.from('department_announcements').insert({
      title: title.trim(), body: body.trim(), category, department: 'ENTC',
      target_year: year ? Number(year) : null, target_semester: semester ? Number(semester) : null,
      expires_at: expires?.toISOString() ?? null, created_by: profileId,
    });
    if (error) toast.error(`Could not publish announcement: ${error.message}`);
    else { toast.success('Announcement published.'); setTitle(''); setBody(''); await refresh(); }
    setBusy(false);
  };
  return <div className="academic-grid">
    <ManagerPanel title="Publish lab timetable session" description="Target a year, semester, and batch, or leave them blank for the whole department.">
      <form className="academic-form" onSubmit={createSession}>
        <label>Subject<input required maxLength={100} value={subject} onChange={event => setSubject(event.target.value)} /></label>
        <div className="academic-form-grid"><label>Faculty name<input required maxLength={120} value={faculty} onChange={event => setFaculty(event.target.value)} /></label><label>Laboratory<input required maxLength={100} value={laboratory} onChange={event => setLaboratory(event.target.value)} /></label></div>
        <div className="academic-form-grid"><label>Starts<input type="datetime-local" required value={startsAt} onChange={event => setStartsAt(event.target.value)} /></label><label>Ends<input type="datetime-local" required value={endsAt} onChange={event => setEndsAt(event.target.value)} /></label></div>
        <div className="academic-form-grid"><label>Year<select value={year} onChange={event => setYear(event.target.value)}><option value="">All years</option>{[1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></label><label>Semester<select value={semester} onChange={event => setSemester(event.target.value)}><option value="">All semesters</option>{[1,2,3,4,5,6,7,8].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <label>Batch (optional)<input maxLength={50} value={batch} onChange={event => setBatch(event.target.value)} /></label>
        <label>Schedule change note (optional)<textarea rows={2} maxLength={500} value={changeNotice} onChange={event => setChangeNotice(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Publish session</button>
      </form>
    </ManagerPanel>
    <ManagerPanel title="Publish department notice" description="Notices are visible to matched student accounts until the expiry time.">
      <form className="academic-form" onSubmit={publishAnnouncement}>
        <label>Title<input required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label>Category<select value={category} onChange={event => setCategory(event.target.value as DepartmentAnnouncement['category'])}>{[['general','General'],['practical_exam','Practical exam'],['deadline','Deadline'],['maintenance','Maintenance'],['equipment','Equipment']].map(([value,labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>
        <label>Message<textarea rows={5} required maxLength={5000} value={body} onChange={event => setBody(event.target.value)} /></label>
        <div className="academic-form-grid"><label>Target year<select value={year} onChange={event => setYear(event.target.value)}><option value="">All years</option>{[1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></label><label>Target semester<select value={semester} onChange={event => setSemester(event.target.value)}><option value="">All semesters</option>{[1,2,3,4,5,6,7,8].map(value => <option key={value}>{value}</option>)}</select></label></div>
        <label>Expires at (optional)<input type="datetime-local" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit" disabled={busy}>Publish notice</button>
      </form>
    </ManagerPanel>
  </div>;
}
