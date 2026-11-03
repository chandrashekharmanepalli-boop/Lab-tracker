import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, Bell, CalendarDays,
  CheckCircle2, Clock3, FlaskConical, Gauge, Laptop, Search, Send, UserRound,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useLabData } from '../contexts/LabDataContext';
import { supabase } from '../lib/supabase';
import { formatDate, formatDateTime, isOverdue } from '../lib/utils';
import { readLabHours, WEEKDAYS } from '../lib/labHours';
import type {
  DepartmentAnnouncement, EquipmentBooking, EquipmentDamageReport, Instrument,
  LabAttendance, LabSession, PracticalExperiment, Student, StudentExperiment,
  StudentExperimentEvaluation, StudentExperimentSubmission,
} from '../types/database';
import toast from 'react-hot-toast';

type PortalTab = 'Overview' | 'Experiments' | 'Attendance' | 'Equipment' | 'Reports' | 'Performance' | 'Timetable' | 'Notices' | 'Profile';
type PortalData = {
  assignments: StudentExperiment[];
  experiments: PracticalExperiment[];
  submissions: StudentExperimentSubmission[];
  evaluations: StudentExperimentEvaluation[];
  attendance: LabAttendance[];
  bookings: EquipmentBooking[];
  damageReports: EquipmentDamageReport[];
  instruments: Instrument[];
  sessions: LabSession[];
  announcements: DepartmentAnnouncement[];
};

const EMPTY_PORTAL: PortalData = {
  assignments: [], experiments: [], submissions: [], evaluations: [], attendance: [],
  bookings: [], damageReports: [], instruments: [], sessions: [], announcements: [],
};
const TABS: PortalTab[] = ['Overview', 'Experiments', 'Attendance', 'Equipment', 'Reports', 'Performance', 'Timetable', 'Notices', 'Profile'];
const NAV_ICONS = [Gauge, FlaskConical, CalendarDays, Laptop, ArrowDownToLine, CheckCircle2, Clock3, Bell, UserRound];
const FILE_LIMIT = 15 * 1024 * 1024;
const RESULT_TYPES = ['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png'];

export default function StudentDashboardPage() {
  const { profile } = useAuth();
  const { students, transactions, gateEvents, alerts } = useLabData();
  const student = students.find(item => item.profile_id === profile?.id);
  const [activeTab, setActiveTab] = useState<PortalTab>('Overview');
  const [data, setData] = useState<PortalData>(EMPTY_PORTAL);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hoursValue, setHoursValue] = useState<unknown>(null);
  const [hoursError, setHoursError] = useState<string | null>(null);

  const loadPortal = useCallback(async () => {
    if (!student) {
      setLoading(false);
      setData(EMPTY_PORTAL);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const now = new Date().toISOString();
    const results = await Promise.all([
      supabase.from('student_experiments').select('*').eq('student_id', student.id).order('assigned_at', { ascending: false }),
      supabase.from('practical_experiments').select('*').order('subject').order('experiment_number'),
      supabase.from('student_experiment_submissions').select('*').eq('student_id', student.id).order('submitted_at', { ascending: false }),
      supabase.from('student_experiment_evaluations').select('*').eq('student_id', student.id),
      supabase.from('lab_attendance').select('*').eq('student_id', student.id).order('attendance_date', { ascending: false }),
      supabase.from('equipment_bookings').select('*').eq('student_id', student.id).order('requested_at', { ascending: false }),
      supabase.from('equipment_damage_reports').select('*').eq('student_id', student.id).order('reported_at', { ascending: false }),
      supabase.from('instruments').select('*').order('name'),
      supabase.from('lab_sessions').select('*').gte('starts_at', now).order('starts_at'),
      supabase.from('department_announcements').select('*').order('published_at', { ascending: false }),
    ]);
    const failed = results.find(result => result.error);
    if (failed?.error) {
      setLoadError(`Could not load student portal data: ${failed.error.message}`);
      setLoading(false);
      return;
    }
    const [assignments, experiments, submissions, evaluations, attendance, bookings, damageReports, instruments, sessions, announcements] = results;
    const experimentMap = new Map((experiments.data ?? []).map(item => [item.id, item]));
    setData({
      assignments: (assignments.data ?? []).map(item => ({ ...item, experiment: experimentMap.get(item.experiment_id) })),
      experiments: experiments.data ?? [],
      submissions: submissions.data ?? [],
      evaluations: evaluations.data ?? [],
      attendance: attendance.data ?? [],
      bookings: bookings.data ?? [],
      damageReports: damageReports.data ?? [],
      instruments: instruments.data ?? [],
      sessions: sessions.data ?? [],
      announcements: announcements.data ?? [],
    });
    setLoading(false);
  }, [student]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadPortal(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPortal]);
  useEffect(() => {
    if (!student) return;
    const tables = [
      'student_experiments', 'practical_experiments', 'student_experiment_submissions',
      'student_experiment_evaluations', 'lab_attendance', 'equipment_bookings',
      'equipment_damage_reports', 'lab_sessions', 'department_announcements', 'instruments',
    ];
    const channel = supabase.channel(`student-portal-${student.id}`);
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => { void loadPortal(); });
    }
    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setLoadError(`Live portal updates are unavailable (${status}). Use Refresh or reload the page to check for changes.`);
      }
    });
    return () => { void supabase.removeChannel(channel); };
  }, [student, loadPortal]);
  useEffect(() => {
    let active = true;
    void supabase.rpc('get_lab_hours').then(({ data: value, error }) => {
      if (!active) return;
      if (error) setHoursError(`Could not load lab hours: ${error.message}`);
      else setHoursValue(value);
    });
    return () => { active = false; };
  }, []);

  const ownedTransactions = useMemo(() => transactions.filter(item => item.student_id === student?.id)
    .sort((a, b) => Date.parse(b.issue_date) - Date.parse(a.issue_date)), [transactions, student]);
  const ownedGateEvents = useMemo(() => gateEvents.filter(item => item.student_id === student?.id)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [gateEvents, student]);
  const ownedAlerts = alerts.filter(item => item.student_id === student?.id);
  const evaluationByAssignment = new Map(data.evaluations.map(item => [item.assignment_id, item]));
  const completed = data.assignments.filter(item => item.status === 'completed').length;
  const pending = data.assignments.length - completed;
  const presentCount = data.attendance.filter(item => item.status === 'present' || item.status === 'late').length;
  const attendancePercent = data.attendance.length ? Math.round((presentCount / data.attendance.length) * 100) : null;
  const pendingReports = data.assignments.filter(assignment =>
    assignment.report_due_at && !data.submissions.some(submission => submission.assignment_id === assignment.id && submission.submission_type === 'report'),
  );
  const labHours = readLabHours(hoursValue);

  if (!student) {
    return <EmptyLinkedStudent />;
  }

  return (
    <div className="student-portal">
      <header className="student-hero">
        <div>
          <p className="student-eyebrow">ENTC LAB PORTAL</p>
          <h1>Welcome back, {student.name.split(' ')[0]}</h1>
          <p>{student.roll_no} <span>·</span> {student.department}, Year {student.year}{student.semester ? ` · Semester ${student.semester}` : ''}</p>
        </div>
        <span className="student-account-badge"><CheckCircle2 size={15} /> Verified student</span>
      </header>

      <nav className="student-tabs" aria-label="Student portal sections">
        {TABS.map((tab, index) => {
          const Icon = NAV_ICONS[index];
          return (
            <button type="button" key={tab} onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'active' : ''}>
              <Icon size={16} />{tab}
            </button>
          );
        })}
      </nav>

      {loadError && <div className="alert alert-danger" role="alert">{loadError}<button className="btn btn-sm btn-secondary" onClick={() => void loadPortal()}>Retry</button></div>}
      {loading ? <PortalLoading /> : (
        <>
          {activeTab === 'Overview' && <OverviewTab
            student={student} data={data} completed={completed} pending={pending}
            attendancePercent={attendancePercent} pendingReports={pendingReports.length}
            studentTransactions={ownedTransactions} studentGateEvents={ownedGateEvents}
            studentAlerts={ownedAlerts} labHours={labHours} hoursError={hoursError}
            onNavigate={setActiveTab}
          />}
          {activeTab === 'Experiments' && <ExperimentsTab data={data} evaluationByAssignment={evaluationByAssignment} onRefresh={loadPortal} />}
          {activeTab === 'Attendance' && <AttendanceTab attendance={data.attendance} attendancePercent={attendancePercent} />}
          {activeTab === 'Equipment' && <EquipmentTab student={student} data={data} onRefresh={loadPortal} />}
          {activeTab === 'Reports' && <ReportsTab data={data} evaluationByAssignment={evaluationByAssignment} onRefresh={loadPortal} />}
          {activeTab === 'Performance' && <PerformanceTab data={data} attendancePercent={attendancePercent} />}
          {activeTab === 'Timetable' && <TimetableTab sessions={data.sessions} labHours={labHours} hoursError={hoursError} />}
          {activeTab === 'Notices' && <NoticesTab announcements={data.announcements} />}
          {activeTab === 'Profile' && <ProfileTab student={student} email={profile?.email} phone={profile?.phone} />}
        </>
      )}
    </div>
  );
}

function EmptyLinkedStudent() {
  return (
    <section className="student-empty card">
      <AlertTriangle size={32} color="var(--warning-500)" />
      <h2>Student record not linked yet</h2>
      <p>Ask a lab administrator to verify your student directory record and link it to this login. Your private academic dashboard will be available after it is linked.</p>
    </section>
  );
}

function PortalLoading() {
  return <div className="student-stat-grid" aria-label="Loading student portal" role="status">{Array.from({ length: 6 }, (_, index) => <div className="student-skeleton" key={index} />)}</div>;
}

function StatCard({ title, value, detail, icon, tone = 'blue' }: { title: string; value: string | number; detail: string; icon: React.ReactNode; tone?: string }) {
  return <article className={`student-stat-card ${tone}`}><div className="student-stat-icon">{icon}</div><p>{title}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function Panel({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <section className="student-panel"><header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{icon && <span className="student-panel-icon">{icon}</span>}</header><div className="student-panel-body">{children}</div></section>;
}

function OverviewTab({ student, data, completed, pending, attendancePercent, pendingReports, studentTransactions, studentGateEvents, studentAlerts, labHours, hoursError, onNavigate }: {
  student: Student; data: PortalData; completed: number; pending: number; attendancePercent: number | null;
  pendingReports: number; studentTransactions: ReturnType<typeof useLabData>['transactions'];
  studentGateEvents: ReturnType<typeof useLabData>['gateEvents']; studentAlerts: ReturnType<typeof useLabData>['alerts'];
  labHours: ReturnType<typeof readLabHours>; hoursError: string | null; onNavigate: (tab: PortalTab) => void;
}) {
  const upcomingSessions = data.sessions.slice(0, 3);
  const activities = [
    ...data.submissions.map(item => ({ id: item.id, time: item.submitted_at, text: `${item.submission_type === 'report' ? 'Report' : 'Result'} submitted`, detail: data.assignments.find(assignment => assignment.id === item.assignment_id)?.experiment?.name ?? 'Practical experiment' })),
    ...data.attendance.slice(0, 4).map(item => ({ id: item.id, time: `${item.attendance_date}T12:00:00`, text: `Attendance marked ${item.status}`, detail: item.subject || 'Lab session' })),
    ...studentTransactions.slice(0, 3).map(item => ({ id: item.id, time: item.issue_date, text: item.status === 'returned' ? 'Equipment returned' : 'Equipment issued', detail: item.instrument?.name ?? 'Laboratory equipment' })),
    ...studentGateEvents.slice(0, 3).map(item => ({ id: item.id, time: item.timestamp, text: `Lab ${item.direction}`, detail: item.instrument?.name ?? 'RFID gate activity' })),
  ].sort((a, b) => Date.parse(b.time) - Date.parse(a.time)).slice(0, 6);
  return (
    <>
      <div className="student-stat-grid">
        <StatCard title="Assigned experiments" value={data.assignments.length} detail="Practical work assigned to you" icon={<FlaskConical size={20} />} />
        <StatCard title="Completed" value={completed} detail="Evaluated / completed experiments" icon={<CheckCircle2 size={20} />} tone="green" />
        <StatCard title="Pending work" value={pending} detail="Pending or in progress" icon={<Clock3 size={20} />} tone="amber" />
        <StatCard title="Lab attendance" value={attendancePercent === null ? '—' : `${attendancePercent}%`} detail={attendancePercent === null ? 'No official records yet' : `${data.attendance.length} recorded sessions`} icon={<CalendarDays size={20} />} tone="cyan" />
        <StatCard title="Reports due" value={pendingReports} detail="Assigned reports not submitted" icon={<ArrowDownToLine size={20} />} tone="violet" />
        <StatCard title="Equipment requests" value={data.bookings.filter(item => item.status === 'pending').length} detail={`${studentAlerts.length} lab alert${studentAlerts.length === 1 ? '' : 's'}`} icon={<Laptop size={20} />} tone="rose" />
      </div>
      <div className="student-two-column">
        <Panel title="Upcoming practical sessions" subtitle="Your published lab timetable" icon={<CalendarDays size={18} />}>
          {upcomingSessions.length ? <div className="student-session-list">{upcomingSessions.map(session => <div className="student-session" key={session.id}><div className="student-session-date">{new Date(session.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div><div><strong>{session.subject}</strong><p>{session.faculty_name} · {session.laboratory}</p><small>{formatDateTime(session.starts_at)} – {new Date(session.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>{session.change_notice && <p className="student-session-notice">{session.change_notice}</p>}</div></div>)}</div> : <EmptyState text="No upcoming practical sessions have been published." />}
          <button className="student-text-button" onClick={() => onNavigate('Timetable')}>View full timetable →</button>
        </Panel>
        <Panel title="Department announcements" subtitle="Latest notices for your class" icon={<Bell size={18} />}>
          {data.announcements.slice(0, 3).length ? data.announcements.slice(0, 3).map(item => <article className="student-notice-preview" key={item.id}><span className={`student-tag ${item.category}`}>{item.category.replace('_', ' ')}</span><strong>{item.title}</strong><p>{item.body}</p><small>{formatDateTime(item.published_at)}</small></article>) : <EmptyState text="No active department announcements." />}
          <button className="student-text-button" onClick={() => onNavigate('Notices')}>See all notices →</button>
        </Panel>
      </div>
      <div className="student-two-column">
        <Panel title="Recent activity" subtitle="Your latest lab and academic activity" icon={<ArrowLeftRight size={18} />}>
          {activities.length ? activities.map(item => <div className="student-activity-row" key={item.id}><span className="student-activity-dot" /><div><strong>{item.text}</strong><p>{item.detail}</p></div><time>{formatDate(item.time)}</time></div>) : <EmptyState text="Your recent activity will appear here." />}
        </Panel>
        <Panel title="Lab opening hours" subtitle="Department schedule" icon={<Clock3 size={18} />}>
          {hoursError && <p className="student-error">{hoursError}</p>}
          {labHours ? WEEKDAYS.map(({ key, label }) => <div className="student-hours-row" key={key}><span>{label}</span><strong>{labHours[key].open ? `${labHours[key].opens} – ${labHours[key].closes}` : 'Closed'}</strong></div>) : !hoursError && <EmptyState text="Opening hours have not been published." />}
        </Panel>
      </div>
      {studentAlerts.some(alert => !alert.acknowledged) && <div className="alert alert-warning"><AlertTriangle size={16} /> You have {studentAlerts.filter(alert => !alert.acknowledged).length} unacknowledged lab security alert(s). Contact lab staff if you need help.</div>}
      <p className="student-private-note">Showing private academic records for {student.roll_no}. RFID entry events are lab activity only and are not used to calculate attendance.</p>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="student-empty-state">{text}</div>;
}

function ExperimentsTab({ data, evaluationByAssignment, onRefresh }: { data: PortalData; evaluationByAssignment: Map<string, StudentExperimentEvaluation>; onRefresh: () => Promise<void> }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const filtered = data.assignments.filter(item => {
    const query = search.trim().toLowerCase();
    const matchesText = !query || `${item.experiment?.name ?? ''} ${item.experiment?.subject ?? ''} ${item.experiment?.experiment_number ?? ''}`.toLowerCase().includes(query);
    return matchesText && (status === 'all' || item.status === status);
  });
  const submitFile = async (assignment: StudentExperiment, type: 'result' | 'report', file: File | undefined) => {
    if (!file) return;
    if (file.size > FILE_LIMIT) { toast.error('Files must be 15 MB or smaller.'); return; }
    const allowed = type === 'report' ? file.type === 'application/pdf' : RESULT_TYPES.includes(file.type);
    if (!allowed) { toast.error(type === 'report' ? 'Practical reports must be PDF files.' : 'Upload a PDF, image, CSV, or text result file.'); return; }
    setBusy(assignment.id);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${assignment.student_id}/${assignment.id}/${type}/${crypto.randomUUID()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('student-lab-files').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { toast.error(`Upload failed: ${uploadError.message}`); setBusy(null); return; }
    const { error } = await supabase.rpc('submit_student_experiment', {
      p_assignment_id: assignment.id, p_submission_type: type, p_file_path: path, p_notes: '',
    });
    if (error) {
      const { error: cleanupError } = await supabase.storage.from('student-lab-files').remove([path]);
      if (cleanupError) toast.error(`Submission failed and uploaded file could not be removed: ${cleanupError.message}`);
      else toast.error(`Submission failed: ${error.message}`);
    } else {
      toast.success(type === 'report' ? 'Report submitted.' : 'Experiment result submitted.');
      await onRefresh();
    }
    setBusy(null);
  };
  return (
    <Panel title="My experiments" subtitle="Assigned practical work, instructions, results, and faculty feedback" icon={<FlaskConical size={18} />}>
      <div className="student-toolbar"><div className="student-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search experiments or subjects" /></div><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></div>
      {filtered.length ? <div className="student-experiment-list">{filtered.map(assignment => {
        const evaluation = evaluationByAssignment.get(assignment.id);
        const submissions = data.submissions.filter(item => item.assignment_id === assignment.id);
        return <article className="student-experiment-card" key={assignment.id}>
          <div className="student-experiment-heading"><div><span className="student-tag">{assignment.experiment?.subject ?? 'Practical'}</span><span className="student-experiment-number">Experiment {assignment.experiment?.experiment_number ?? '—'}</span><h3>{assignment.experiment?.name ?? 'Assigned experiment'}</h3></div><span className={`student-status ${assignment.status}`}>{assignment.status.replace('_', ' ')}</span></div>
          {assignment.experiment?.instructions && <p className="student-instructions">{assignment.experiment.instructions}</p>}
          <div className="student-deadline-row"><span>Assigned {formatDate(assignment.assigned_at)}</span>{assignment.due_at && <span>Practical due {formatDate(assignment.due_at)}</span>}{assignment.report_due_at && <span>Report due {formatDate(assignment.report_due_at)}</span>}</div>
          <div className="student-upload-row"><label className="btn btn-secondary btn-sm">{busy === assignment.id ? 'Uploading…' : 'Upload result'}<input type="file" accept=".pdf,.txt,.csv,image/jpeg,image/png" disabled={busy !== null} onChange={event => { void submitFile(assignment, 'result', event.target.files?.[0]); event.currentTarget.value = ''; }} /></label><label className="btn btn-secondary btn-sm">{busy === assignment.id ? 'Uploading…' : 'Submit PDF report'}<input type="file" accept="application/pdf,.pdf" disabled={busy !== null} onChange={event => { void submitFile(assignment, 'report', event.target.files?.[0]); event.currentTarget.value = ''; }} /></label></div>
          <div className="student-submission-list">{submissions.map(item => <div key={item.id}><span>{item.submission_type === 'report' ? 'Report' : 'Result'} submitted {formatDateTime(item.submitted_at)}</span><button className="student-inline-button" onClick={() => void openPrivateFile(item.file_path)}>Open file</button></div>)}</div>
          {evaluation && <div className="student-evaluation"><strong>Faculty marks: {evaluation.marks} / {evaluation.max_marks}</strong>{evaluation.remarks && <p>{evaluation.remarks}</p>}<small>Evaluated {formatDate(evaluation.evaluated_at)}</small>{evaluation.feedback_file_path && <button className="student-inline-button" onClick={() => void openPrivateFile(evaluation.feedback_file_path!)}>Download evaluated report</button>}</div>}
        </article>;
      })}</div> : <EmptyState text={data.assignments.length ? 'No experiments match your search and filter.' : 'No experiments have been assigned to your student record yet.'} />}
    </Panel>
  );
}

async function openPrivateFile(path: string) {
  const { data, error } = await supabase.storage.from('student-lab-files').createSignedUrl(path, 60);
  if (error) { toast.error(`Could not open file: ${error.message}`); return; }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

function AttendanceTab({ attendance, attendancePercent }: { attendance: LabAttendance[]; attendancePercent: number | null }) {
  const [month, setMonth] = useState(() => new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = new Date(year, monthIndex, 1).getDay();
  const monthAttendance = attendance.filter(item => item.attendance_date.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`));
  const byDay = new Map(monthAttendance.map(item => [Number(item.attendance_date.slice(8, 10)), item]));
  const absentCount = attendance.filter(item => item.status === 'absent').length;
  return <>
    <div className="student-stat-grid student-stat-grid--compact"><StatCard title="Overall attendance" value={attendancePercent === null ? '—' : `${attendancePercent}%`} detail="Present and late count as attended" icon={<CalendarDays size={20} />} tone="cyan" /><StatCard title="Recorded sessions" value={attendance.length} detail="Official lab register records" icon={<CheckCircle2 size={20} />} tone="green" /><StatCard title="Absences" value={absentCount} detail="Recorded absent sessions" icon={<AlertTriangle size={20} />} tone="amber" /></div>
    {attendancePercent !== null && attendancePercent < 75 && <div className="alert alert-warning"><AlertTriangle size={16} /> Attendance is below 75%. Please contact your faculty advisor about the attendance-shortage policy.</div>}
    <div className="student-two-column">
      <Panel title="Monthly attendance" subtitle={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} icon={<CalendarDays size={18} />}>
        <div className="student-calendar-controls"><button className="btn btn-secondary btn-sm" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>Previous</button><button className="btn btn-secondary btn-sm" onClick={() => setMonth(new Date())}>This month</button><button className="btn btn-secondary btn-sm" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>Next</button></div>
        <div className="student-calendar"><div className="student-calendar-head">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}</div><div className="student-calendar-days">{Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}{Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1; const record = byDay.get(day);
          return <div className={`student-calendar-day ${record ? record.status : ''}`} key={day} title={record ? `${record.subject}: ${record.status}` : undefined}><span>{day}</span>{record && <small>{record.status === 'present' ? 'P' : record.status === 'late' ? 'L' : 'A'}</small>}</div>;
        })}</div></div>
        <div className="student-calendar-legend"><span><i className="present" />Present</span><span><i className="late" />Late</span><span><i className="absent" />Absent</span></div>
      </Panel>
      <Panel title="Attendance history" subtitle="Official records entered by faculty or lab staff" icon={<Clock3 size={18} />}>
        {attendance.length ? <div className="student-history-list">{attendance.map(item => <div key={item.id}><div><strong>{formatDate(item.attendance_date)}</strong><p>{item.subject || 'Lab session'}{item.remarks ? ` · ${item.remarks}` : ''}</p></div><span className={`student-status ${item.status}`}>{item.status}</span></div>)}</div> : <EmptyState text="No official attendance has been recorded. RFID gate visits are not used as attendance." />}
      </Panel>
    </div>
  </>;
}

function EquipmentTab({ student, data, onRefresh }: { student: Student; data: PortalData; onRefresh: () => Promise<void> }) {
  const [instrumentId, setInstrumentId] = useState('');
  const [neededUntil, setNeededUntil] = useState('');
  const [purpose, setPurpose] = useState('');
  const [damageInstrument, setDamageInstrument] = useState('');
  const [damageBooking, setDamageBooking] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const equipmentName = (id: string) => data.instruments.find(item => item.id === id)?.name ?? 'Laboratory equipment';
  const activeBookingIds = new Set(data.bookings.filter(item => ['pending', 'approved', 'issued'].includes(item.status)).map(item => item.instrument_id));
  const availableInstruments = data.instruments.filter(item => item.status === 'available' && !activeBookingIds.has(item.id));
  const damageEquipmentOptions = new Map<string, { id: string; bookingId: string }>();
  data.bookings.filter(item => ['approved', 'issued', 'returned'].includes(item.status))
    .forEach(item => damageEquipmentOptions.set(item.instrument_id, { id: item.instrument_id, bookingId: item.id }));
  data.instruments.filter(item => item.status === 'borrowed')
    .forEach(item => damageEquipmentOptions.set(item.id, { id: item.id, bookingId: '' }));
  const requestBooking = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!instrumentId || !neededUntil || !purpose.trim()) { toast.error('Choose equipment, a return time, and purpose.'); return; }
    const until = new Date(neededUntil);
    if (Number.isNaN(until.getTime()) || until <= new Date()) { toast.error('The needed-until time must be in the future.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('request_student_equipment', {
      p_instrument_id: instrumentId, p_needed_until: until.toISOString(), p_purpose: purpose.trim(),
    });
    if (error) toast.error(`Could not request equipment: ${error.message}`);
    else { toast.success('Equipment request sent to lab staff.'); setPurpose(''); setInstrumentId(''); await onRefresh(); }
    setBusy(false);
  };
  const reportDamage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!damageInstrument || !description.trim()) { toast.error('Choose equipment and describe the damage.'); return; }
    setBusy(true);
    const { error } = await supabase.from('equipment_damage_reports').insert({
      student_id: student.id, instrument_id: damageInstrument, booking_id: damageBooking || null, description: description.trim(), status: 'open',
    });
    if (error) toast.error(`Could not submit damage report: ${error.message}`);
    else { toast.success('Damage report sent to lab staff.'); setDescription(''); setDamageBooking(''); await onRefresh(); }
    setBusy(false);
  };
  return <>
    <div className="student-two-column">
      <Panel title="Request equipment" subtitle="Choose available lab equipment and tell staff when you need it" icon={<Laptop size={18} />}>
        <form className="student-form" onSubmit={requestBooking}>
          <label>Available equipment<select required value={instrumentId} onChange={event => setInstrumentId(event.target.value)}><option value="">Select equipment</option>{availableInstruments.map(item => <option value={item.id} key={item.id}>{item.name} · {item.instrument_id}</option>)}</select></label>
          {!availableInstruments.length && <p className="student-muted">No equipment is currently listed as available.</p>}
          <label>Needed until<input type="datetime-local" required value={neededUntil} onChange={event => setNeededUntil(event.target.value)} /></label>
          <label>Purpose<textarea required maxLength={500} rows={3} value={purpose} onChange={event => setPurpose(event.target.value)} placeholder="Describe the practical or lab task" /></label>
          <button className="btn btn-primary" type="submit" disabled={busy || !availableInstruments.length}><Send size={15} />Send request</button>
        </form>
      </Panel>
      <Panel title="Report equipment damage" subtitle="Report issues with equipment currently or recently issued to you" icon={<AlertTriangle size={18} />}>
        <form className="student-form" onSubmit={reportDamage}>
          <label>Issued equipment<select required value={damageInstrument} onChange={event => { setDamageInstrument(event.target.value); setDamageBooking(''); }}><option value="">Select equipment</option>{[...damageEquipmentOptions.values()].map(item => <option key={item.id} value={item.id}>{equipmentName(item.id)}</option>)}</select></label>
          {damageInstrument && data.bookings.some(item => item.instrument_id === damageInstrument && ['approved', 'issued', 'returned'].includes(item.status)) && <label>Related equipment request (optional)<select value={damageBooking} onChange={event => setDamageBooking(event.target.value)}><option value="">Not linked to a request</option>{data.bookings.filter(item => item.instrument_id === damageInstrument && ['approved', 'issued', 'returned'].includes(item.status)).map(item => <option key={item.id} value={item.id}>{formatDate(item.requested_at)} · {item.status}</option>)}</select></label>}
          <label>What happened?<textarea required minLength={8} maxLength={1000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Describe the condition and when you noticed it" /></label>
          <button className="btn btn-secondary" type="submit" disabled={busy || !damageInstrument}><Send size={15} />Submit damage report</button>
        </form>
      </Panel>
    </div>
    <div className="student-two-column">
      <Panel title="My equipment requests" subtitle="Approval, issue, and return status" icon={<ArrowLeftRight size={18} />}>
        {data.bookings.length ? <div className="student-history-list">{data.bookings.map(item => <div key={item.id}><div><strong>{equipmentName(item.instrument_id)}</strong><p>{item.purpose} · needed until {formatDateTime(item.needed_until)}</p></div><span className={`student-status ${item.status}`}>{item.status}</span></div>)}</div> : <EmptyState text="You have not requested equipment." />}
      </Panel>
      <Panel title="My damage reports" subtitle="Follow up with lab staff on reported issues" icon={<AlertTriangle size={18} />}>
        {data.damageReports.length ? <div className="student-history-list">{data.damageReports.map(item => <div key={item.id}><div><strong>{item.instrument_id ? equipmentName(item.instrument_id) : 'Equipment'}</strong><p>{item.description}</p>{item.resolution && <small>Resolution: {item.resolution}</small>}</div><span className={`student-status ${item.status}`}>{item.status}</span></div>)}</div> : <EmptyState text="No equipment damage reports submitted." />}
      </Panel>
    </div>
  </>;
}

function ReportsTab({ data, evaluationByAssignment, onRefresh }: { data: PortalData; evaluationByAssignment: Map<string, StudentExperimentEvaluation>; onRefresh: () => Promise<void> }) {
  const dueAssignments = data.assignments.filter(item => item.report_due_at);
  return <Panel title="Practical reports" subtitle="PDF submission deadlines and faculty evaluation" icon={<ArrowDownToLine size={18} />}>
    {dueAssignments.length ? <div className="student-report-list">{dueAssignments.map(assignment => {
      const submission = data.submissions.find(item => item.assignment_id === assignment.id && item.submission_type === 'report');
      const evaluation = evaluationByAssignment.get(assignment.id);
      return <article key={assignment.id}><div><span className="student-tag">{assignment.experiment?.subject ?? 'Practical'}</span><h3>{assignment.experiment?.name ?? 'Practical report'}</h3><p>Due {formatDate(assignment.report_due_at!)}</p></div><div className="student-report-actions">{submission ? <><span className={`student-status ${evaluation ? 'evaluated' : 'submitted'}`}>{evaluation ? 'Evaluated' : 'Submitted'}</span><button className="btn btn-secondary btn-sm" onClick={() => void openPrivateFile(submission.file_path)}><ArrowDownToLine size={14} />Download report</button></> : <><span className={`student-status ${isOverdue(assignment.report_due_at) ? 'absent' : 'pending'}`}>{isOverdue(assignment.report_due_at) ? 'Overdue' : 'Pending'}</span><span>Submit from the Experiments section</span></>}{evaluation && <><small>{evaluation.marks}/{evaluation.max_marks} marks{evaluation.remarks ? ` · ${evaluation.remarks}` : ''}</small>{evaluation.feedback_file_path && <button className="btn btn-secondary btn-sm" onClick={() => void openPrivateFile(evaluation.feedback_file_path!)}><ArrowDownToLine size={14} />Download evaluated report</button>}</>}</div></article>;
    })}</div> : <EmptyState text="No practical reports have been assigned." />}
    <button className="student-text-button" onClick={() => void onRefresh()}>Refresh submission status</button>
  </Panel>;
}

function PerformanceTab({ data, attendancePercent }: { data: PortalData; attendancePercent: number | null }) {
  const marked = data.assignments.map(item => ({ assignment: item, evaluation: data.evaluations.find(value => value.assignment_id === item.id) })).filter(item => item.evaluation);
  const scorePercent = marked.length ? Math.round(marked.reduce((sum, item) => sum + (item.evaluation!.marks / item.evaluation!.max_marks) * 100, 0) / marked.length) : null;
  const subjectScores = [...new Set(marked.map(item => item.assignment.experiment?.subject ?? 'Other'))].map(subject => {
    const items = marked.filter(item => (item.assignment.experiment?.subject ?? 'Other') === subject);
    const earned = items.reduce((sum, item) => sum + item.evaluation!.marks, 0);
    const possible = items.reduce((sum, item) => sum + item.evaluation!.max_marks, 0);
    return { subject, percent: Math.round(earned / possible * 100) };
  });
  const assignmentsDone = data.assignments.length ? Math.round(data.assignments.filter(item => item.status === 'completed').length / data.assignments.length * 100) : null;
  const attendanceColor = attendancePercent === null ? '#dbe3ee' : attendancePercent >= 75 ? '#2386f5' : '#f59e0b';
  return <>
    <div className="student-stat-grid student-stat-grid--compact"><StatCard title="Average marks" value={scorePercent === null ? '—' : `${scorePercent}%`} detail={marked.length ? `${marked.length} evaluated experiments` : 'No marks published'} icon={<CheckCircle2 size={20} />} tone="green" /><StatCard title="Experiment completion" value={assignmentsDone === null ? '—' : `${assignmentsDone}%`} detail={`${data.assignments.filter(item => item.status === 'completed').length} of ${data.assignments.length} assigned`} icon={<FlaskConical size={20} />} /><StatCard title="Attendance" value={attendancePercent === null ? '—' : `${attendancePercent}%`} detail="Official register records only" icon={<CalendarDays size={20} />} tone="cyan" /></div>
    <div className="student-two-column">
      <Panel title="Subject-wise performance" subtitle="Average marks from faculty evaluations" icon={<Gauge size={18} />}>
        {subjectScores.length ? <div className="student-chart"><ResponsiveContainer width="100%" height={280}><BarChart data={subjectScores} margin={{ top: 8, right: 12, left: -18, bottom: 10 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="subject" tick={{ fontSize: 12 }} /><YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} /><Tooltip formatter={value => [`${value}%`, 'Average']} /><Bar dataKey="percent" fill="#2386f5" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyState text="Your subject performance will appear after faculty evaluates your experiments." />}
      </Panel>
      <Panel title="Progress snapshot" subtitle="Academic indicators from recorded data" icon={<CheckCircle2 size={18} />}>
        <div className="student-progress-donut"><ResponsiveContainer width={150} height={150}><PieChart><Pie data={[{ name: 'Attended', value: presentCountForChart(data.attendance) }, { name: 'Absent', value: data.attendance.filter(item => item.status === 'absent').length }]} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={3}><Cell fill={attendanceColor} /><Cell fill="#e7edf5" /></Pie><Tooltip /></PieChart></ResponsiveContainer><div><strong>{attendancePercent === null ? '—' : `${attendancePercent}%`}</strong><small>Attendance</small></div></div>
        <div className="student-progress-line"><div><span>Experiment completion</span><strong>{assignmentsDone === null ? 'No assignments' : `${assignmentsDone}%`}</strong></div><div className="student-progress-track"><i style={{ width: `${assignmentsDone ?? 0}%` }} /></div></div>
        <p className="student-muted">Semester analytics are based only on published assignments, recorded attendance, and faculty marks. No unrecorded scores are estimated.</p>
      </Panel>
    </div>
    <Panel title="Evaluated experiments" subtitle="Marks and comments from your faculty">
      {marked.length ? <div className="student-history-list">{marked.map(({ assignment, evaluation }) => <div key={assignment.id}><div><strong>{assignment.experiment?.name ?? 'Experiment'}</strong><p>{assignment.experiment?.subject ?? 'Practical'}{evaluation?.remarks ? ` · ${evaluation.remarks}` : ''}</p></div><strong>{evaluation?.marks}/{evaluation?.max_marks}</strong></div>)}</div> : <EmptyState text="No practical marks are available yet." />}
    </Panel>
  </>;
}

function presentCountForChart(attendance: LabAttendance[]) {
  return attendance.filter(item => item.status === 'present' || item.status === 'late').length;
}

function TimetableTab({ sessions, labHours, hoursError }: { sessions: LabSession[]; labHours: ReturnType<typeof readLabHours>; hoursError: string | null }) {
  return <>
    <Panel title="Upcoming laboratory sessions" subtitle="Your class timetable and schedule changes" icon={<CalendarDays size={18} />}>
      {sessions.length ? <div className="student-timetable">{sessions.map(session => <article key={session.id}><div className="student-timetable-date"><strong>{new Date(session.starts_at).toLocaleDateString(undefined, { day: '2-digit' })}</strong><span>{new Date(session.starts_at).toLocaleDateString(undefined, { month: 'short' })}</span></div><div className="student-timetable-info"><span className="student-tag">{session.subject}</span><h3>{session.faculty_name}</h3><p>{session.laboratory} · {formatDateTime(session.starts_at)} – {new Date(session.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>{session.change_notice && <div className="student-session-notice"><Bell size={14} />{session.change_notice}</div>}</div></article>)}</div> : <EmptyState text="No upcoming sessions have been scheduled for your year, semester, or batch." />}
    </Panel>
    <Panel title="Weekly opening hours" subtitle="General laboratory access times" icon={<Clock3 size={18} />}>
      {hoursError && <p className="student-error">{hoursError}</p>}
      {labHours ? <div className="student-opening-grid">{WEEKDAYS.map(({ key, label }) => <div key={key}><span>{label}</span><strong>{labHours[key].open ? `${labHours[key].opens} – ${labHours[key].closes}` : 'Closed'}</strong></div>)}</div> : !hoursError && <EmptyState text="The weekly opening schedule has not been published." />}
    </Panel>
  </>;
}

function NoticesTab({ announcements }: { announcements: DepartmentAnnouncement[] }) {
  return <Panel title="Notices & notifications" subtitle="Faculty announcements, exams, deadlines, maintenance, and equipment updates" icon={<Bell size={18} />}>
    {announcements.length ? <div className="student-notice-list">{announcements.map(item => <article key={item.id}><span className={`student-tag ${item.category}`}>{item.category.replace('_', ' ')}</span><h3>{item.title}</h3><p>{item.body}</p><small>Published {formatDateTime(item.published_at)}{item.expires_at ? ` · Expires ${formatDate(item.expires_at)}` : ''}</small></article>)}</div> : <EmptyState text="No active notices have been published for your department and class." />}
  </Panel>;
}

function ProfileTab({ student, email, phone }: { student: Student; email?: string | null; phone?: string | null }) {
  return <Panel title="My student profile" subtitle="Verified account and academic information" icon={<UserRound size={18} />}>
    <div className="student-profile">
      <div className="student-profile-avatar">{student.photo_url ? <img src={student.photo_url} alt="" /> : student.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div>
      <div><h2>{student.name}</h2><span className="student-account-badge"><CheckCircle2 size={14} />Linked directory record</span></div>
    </div>
    <div className="student-profile-grid">{[
      ['Enrollment / Roll number', student.roll_no], ['Department', student.department],
      ['Academic year', `Year ${student.year}`], ['Semester', student.semester ? `Semester ${student.semester}` : 'Not set'],
      ['Batch', student.batch], ['Directory email', student.email ?? 'Not provided'],
      ['Account email', email ?? 'Not provided'], ['Contact number', student.phone ?? phone ?? 'Not provided'],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <p className="student-muted">For corrections to your verified student directory details, contact a lab administrator.</p>
  </Panel>;
}
