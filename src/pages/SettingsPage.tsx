import { useEffect, useState } from 'react';
import { Settings, Users, Database, Shield, Server, Save, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLabData } from '../contexts/LabDataContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { DEFAULT_LAB_HOURS, readLabHours, WEEKDAYS } from '../lib/labHours';
import type { LabHours } from '../lib/labHours';

const TABS = ['General', 'Users & Roles', 'Database', 'Hardware', 'Security'] as const;
type Tab = typeof TABS[number];

export default function SettingsPage() {
  const { profile } = useAuth();
  const { profiles, students, settings, refresh } = useLabData();
  const [activeTab, setActiveTab] = useState<Tab>('General');
  const [labName, setLabName] = useState('ENTC Department Laboratory');
  const [department, setDepartment] = useState('ENTC');
  const [overdueDays, setOverdueDays] = useState(1);
  const [heartbeatTimeout, setHeartbeatTimeout] = useState(60);
  const [labHours, setLabHours] = useState<LabHours>(DEFAULT_LAB_HOURS);
  const [saving, setSaving] = useState(false);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [studentLinks, setStudentLinks] = useState<Record<string, string>>({});
  const [linkingProfileId, setLinkingProfileId] = useState<string | null>(null);

  const savedGeneral = settings.find(setting => setting.key === 'general')?.value;

  useEffect(() => {
    if (typeof savedGeneral !== 'object' || savedGeneral === null || Array.isArray(savedGeneral)) return;
    const values = savedGeneral as Record<string, unknown>;
    if (typeof values.labName === 'string') setLabName(values.labName);
    if (typeof values.department === 'string') setDepartment(values.department);
    if (typeof values.overdueDays === 'number') setOverdueDays(values.overdueDays);
    if (typeof values.heartbeatTimeout === 'number') setHeartbeatTimeout(values.heartbeatTimeout);
    const savedHours = readLabHours(values.labHours);
    if (savedHours) setLabHours(savedHours);
  }, [savedGeneral]);

  const save = async () => {
    if (!profile) {
      toast.error('Sign in before saving settings');
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert({
      key: 'general',
      value: { labName, department, overdueDays, heartbeatTimeout, labHours },
      updated_by: profile.id,
    });
    setSaving(false);

    if (error) {
      toast.error(`Could not save settings: ${error.message}`);
      return;
    }

    await refresh();
    toast.success('Settings saved');
  };

  const approveStaffAccount = async (accountId: string) => {
    setApprovingUserId(accountId);
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', accountId);
    setApprovingUserId(null);
    if (error) {
      toast.error(`Could not approve account: ${error.message}`);
      return;
    }
    await refresh();
    toast.success('Staff account approved');
  };

  const linkStudentAccount = async (profileId: string) => {
    const studentId = studentLinks[profileId];
    if (!studentId) {
      toast.error('Select a student directory record first');
      return;
    }

    setLinkingProfileId(profileId);
    const { error } = await supabase.rpc('link_student_account', {
      p_student_id: studentId,
      p_profile_id: profileId,
    });
    setLinkingProfileId(null);
    if (error) {
      toast.error(`Could not link student account: ${error.message}`);
      return;
    }
    setStudentLinks(current => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    await refresh();
    toast.success('Student account linked');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">System configuration and administration</p>
        </div>
        {activeTab === 'General' && (
          <button id="save-settings-btn" className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="card" style={{ padding: '8px 0' }}>
            {TABS.map(tab => (
              <button
                key={tab}
                id={`settings-tab-${tab.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', background: activeTab === tab ? 'var(--info-100)' : 'transparent',
                  color: activeTab === tab ? 'var(--blue-500)' : 'var(--gray-600)',
                  fontWeight: activeTab === tab ? 600 : 400, fontSize: '0.875rem',
                  borderRadius: 0, textAlign: 'left', cursor: 'pointer',
                  border: 'none', borderLeft: `3px solid ${activeTab === tab ? 'var(--blue-500)' : 'transparent'}`,
                }}
              >
                {tab === 'General' && <Settings size={15} />}
                {tab === 'Users & Roles' && <Users size={15} />}
                {tab === 'Database' && <Database size={15} />}
                {tab === 'Hardware' && <Server size={15} />}
                {tab === 'Security' && <Shield size={15} />}
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          {activeTab === 'General' && (
            <div className="card">
              <div className="card-header"><p className="card-title">General Settings</p></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="lab-name">Lab Name</label>
                  <input id="lab-name" className="form-control" value={labName} onChange={event => setLabName(event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="department">Department</label>
                  <select id="department" className="form-control" value={department} onChange={event => setDepartment(event.target.value)}>
                    {['ENTC', 'Computer', 'Mechanical', 'Electrical', 'Civil'].map(value => <option key={value}>{value}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="overdue-days">Overdue reminder after (days)</label>
                  <input id="overdue-days" type="number" className="form-control" value={overdueDays} onChange={event => setOverdueDays(Number(event.target.value))} min={1} max={7} style={{ width: 100 }} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="hb-timeout">Device heartbeat timeout (seconds)</label>
                  <input id="hb-timeout" type="number" className="form-control" value={heartbeatTimeout} onChange={event => setHeartbeatTimeout(Number(event.target.value))} min={30} max={300} style={{ width: 120 }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Clock size={16} color="var(--blue-500)" />
                    <p className="form-label" style={{ margin: 0 }}>Weekly lab hours</p>
                  </div>
                  <p className="form-hint" style={{ marginBottom: 12 }}>Set the hours that will appear on the admin and faculty dashboards.</p>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {WEEKDAYS.map(({ key, label }) => (
                      <div key={key} className="lab-hours-row" style={{ display: 'grid', alignItems: 'center', gap: 10, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8rem' }}>
                          <input
                            type="checkbox"
                            checked={labHours[key].open}
                            onChange={event => setLabHours(current => ({
                              ...current,
                              [key]: { ...current[key], open: event.target.checked },
                            }))}
                          />
                          Open
                        </label>
                        <input
                          aria-label={`${label} opening time`}
                          type="time"
                          className="form-control"
                          value={labHours[key].opens}
                          disabled={!labHours[key].open}
                          onChange={event => setLabHours(current => ({
                            ...current,
                            [key]: { ...current[key], opens: event.target.value },
                          }))}
                        />
                        <input
                          aria-label={`${label} closing time`}
                          type="time"
                          className="form-control"
                          value={labHours[key].closes}
                          disabled={!labHours[key].open}
                          onChange={event => setLabHours(current => ({
                            ...current,
                            [key]: { ...current[key], closes: event.target.value },
                          }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Users & Roles' && (
            <div className="card">
              <div className="card-header"><p className="card-title">Registered Accounts</p></div>
              <div className="card-body">
                <div className="alert alert-info" style={{ marginBottom: 16, fontSize: '0.8rem' }}>
                  <Shield size={14} style={{ flexShrink: 0 }} />
                  Staff registrations must be approved here before they can access lab data. Student registrations do not receive staff access.
                </div>
                {profiles.map(account => (
                  <div key={account.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)', marginBottom: 10 }}>
                    <div className="avatar">{account.full_name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{account.full_name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>{account.email ?? account.phone ?? 'No email or phone on file'}</p>
                      {(account.phone || account.subject) && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 4 }}>
                          {[account.phone, account.subject].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="badge borrowed" style={{ textTransform: 'capitalize' }}>{account.role.replace('_', ' ')}</span>
                    {(account.role === 'faculty' || account.role === 'lab_assistant') && (
                      account.is_approved
                        ? <span className="badge available">Approved</span>
                        : <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => void approveStaffAccount(account.id)}
                            disabled={approvingUserId === account.id}
                          >
                            {approvingUserId === account.id ? 'Approving…' : 'Approve staff'}
                          </button>
                    )}
                    {account.role === 'student' && (() => {
                          const linkedStudent = students.find(student => student.profile_id === account.id);
                          if (linkedStudent) {
                            return <span className="badge available">Linked · {linkedStudent.roll_no}</span>;
                          }
                          const unlinkedStudents = students.filter(student => student.is_active && !student.profile_id);
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <select
                                className="form-control"
                                aria-label={`Student record for ${account.full_name}`}
                                value={studentLinks[account.id] ?? ''}
                                onChange={event => setStudentLinks(current => ({ ...current, [account.id]: event.target.value }))}
                                style={{ minWidth: 180 }}
                              >
                                <option value="">Select verified student</option>
                                {unlinkedStudents.map(student => (
                                  <option key={student.id} value={student.id}>{student.name} · {student.roll_no}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => void linkStudentAccount(account.id)}
                                disabled={linkingProfileId === account.id || !studentLinks[account.id]}
                              >
                                {linkingProfileId === account.id ? 'Linking…' : 'Link student'}
                              </button>
                            </div>
                          );
                    })()}
                  </div>
                ))}
                {profiles.length === 0 && <p className="empty-state">No accounts are visible to this user.</p>}
              </div>
            </div>
          )}

          {activeTab === 'Database' && (
            <div className="card">
              <div className="card-header"><p className="card-title">Database Connection</p></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'var(--gray-50)', borderRadius: 8, padding: 16 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--gray-700)', marginBottom: 8 }}>Connection Status</p>
                  <span className={`badge ${isSupabaseConfigured ? 'available' : 'offline'}`}>{isSupabaseConfigured ? 'Configured' : 'Not configured'}</span>
                  {isSupabaseConfigured && <p className="form-hint" style={{ marginTop: 8 }}>{import.meta.env.VITE_SUPABASE_URL}</p>}
                </div>
                <div className="alert alert-warning" style={{ fontSize: '0.8rem' }}>
                  <Shield size={14} style={{ flexShrink: 0 }} />
                  <strong>Never expose the Supabase service-role key.</strong> The app uses the public anon key with database row-level security.
                </div>
                <p className="form-hint">Apply <code>supabase/schema.sql</code> in the Supabase SQL Editor to create the tables and enable Realtime.</p>
              </div>
            </div>
          )}

          {activeTab === 'Hardware' && (
            <div className="card">
              <div className="card-header"><p className="card-title">Hardware Integration</p></div>
              <div className="card-body">
                <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
                  Device status updates from database events. The ESP32 firmware and secured server-side device ingestion endpoints are not included in this repository and must be implemented and deployed before physical RFID or weighing hardware can send data.
                </div>
                <p className="form-hint">Do not put database service-role keys or device secrets in browser code or firmware.</p>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="card">
              <div className="card-header"><p className="card-title">Database Security</p></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="alert alert-info" style={{ fontSize: '0.8rem' }}>
                  Row Level Security is enabled by <code>supabase/schema.sql</code>. Admin and lab-assistant accounts can work with lab records; students can read only their own profile.
                </div>
                {[
                  ['Lab records', 'Read and write: admin, lab assistant'],
                  ['Profiles', 'Read own profile; lab staff can view profiles; only admin can manage roles'],
                  ['Device ingestion', 'No public device ingestion endpoint is deployed by this app'],
                ].map(([label, policy]) => (
                  <div key={label} style={{ padding: '12px 16px', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-900)' }}>{label}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 4 }}>{policy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
