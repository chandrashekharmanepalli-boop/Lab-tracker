import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import type { StudentRegistrationDetails } from '../contexts/AuthContext';
import type { UserRole } from '../types/database';
import { normalizePhoneNumber } from '../lib/phone';

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('email');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [department, setDepartment] = useState('ENTC');
  const [academicYear, setAcademicYear] = useState('');
  const [semester, setSemester] = useState('');
  const [batch, setBatch] = useState('');
  const [role, setRole] = useState<UserRole>('student');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const { signIn, signUp, verifyPhoneSignup, resendPhoneSignupCode, isConfigured, authError, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) navigate('/dashboard', { replace: true });
  }, [profile, navigate]);

  if (profile) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const rawIdentifier = identifier.trim();
    const normalizedPhone = authMethod === 'phone' || (!isRegistering && !rawIdentifier.includes('@'))
      ? normalizePhoneNumber(rawIdentifier)
      : null;
    if ((authMethod === 'phone' || (!isRegistering && !rawIdentifier.includes('@'))) && !normalizedPhone) {
      setError('Enter a valid phone number with country code. Indian 10-digit mobile numbers are also supported.');
      return;
    }
    if (isRegistering && authMethod === 'email' && !rawIdentifier.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (isRegistering && role === 'student' && (!rollNo.trim() || !academicYear || !semester || !batch.trim())) {
      setError('Complete your roll number, department, year, semester, and batch.');
      return;
    }
    if (isRegistering && role === 'student' && authMethod === 'email' && !phone.trim()) {
      setError('Enter your mobile number to complete student registration.');
      return;
    }

    setLoading(true);
    const result: { error: string | null; requiresPhoneConfirmation?: boolean } = isRegistering
      ? await signUp(
          authMethod === 'phone' ? normalizedPhone! : rawIdentifier,
          authMethod === 'phone',
          password,
          fullName.trim(),
          role,
          authMethod === 'phone' ? normalizedPhone! : phone.trim(),
          subject.trim(),
          role === 'student' ? {
            rollNo: rollNo.trim(),
            department,
            year: Number(academicYear),
            semester: Number(semester),
            batch: batch.trim(),
          } satisfies StudentRegistrationDetails : undefined,
        )
      : await signIn(normalizedPhone ?? rawIdentifier, password);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    if (isRegistering) {
      if (result.requiresPhoneConfirmation && normalizedPhone) {
        setPendingPhone(normalizedPhone);
        setSuccess('');
        return;
      }
      setSuccess(authMethod === 'phone'
        ? 'Account created. Your phone number is verified and you can sign in.'
        : 'Account created. Check your email to confirm your address, then sign in.');
      setIsRegistering(false);
      setPassword('');
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleVerifyPhone = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingPhone) return;
    setError('');
    setLoading(true);
    const result = await verifyPhoneSignup(pendingPhone, verificationCode.trim());
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  const handleResendPhoneCode = async () => {
    if (!pendingPhone) return;
    setError('');
    setLoading(true);
    const result = await resendPhoneSignupCode(pendingPhone);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess('A new verification code was sent by SMS.');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <FlaskConical size={32} color="white" />
          </div>
          <h1>Lab Tracker</h1>
          <p>Smart Lab Inventory & Instrument Tracking System</p>
        </div>

        {!isConfigured ? (
          <div className="alert" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24', marginBottom: 20, borderRadius: 8 }}>
            <WifiOff size={16} style={{ flexShrink: 0 }} />
            <span><strong>Backend not configured.</strong> Create a Supabase project, run the schema, and configure the local .env file.</span>
          </div>
        ) : (
          <div className="alert" style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', marginBottom: 20, borderRadius: 8 }}>
            <Wifi size={16} style={{ flexShrink: 0 }} />
            <span>Supabase is configured. {pendingPhone ? 'Verify your mobile number to finish registration.' : isRegistering ? 'Create your account below.' : 'Sign in with email or mobile number.'}</span>
          </div>
        )}

        {isConfigured && pendingPhone && (
          <form className="auth-form" onSubmit={handleVerifyPhone}>
            <p className="auth-registration-note">Enter the SMS verification code sent to {pendingPhone}.</p>
            <div className="form-group">
              <label className="form-label" htmlFor="phone-verification-code">Verification code</label>
              <input
                id="phone-verification-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="form-control"
                value={verificationCode}
                onChange={event => setVerificationCode(event.target.value)}
                required
              />
            </div>
            {(error || authError) && <div className="auth-error">{error || authError}</div>}
            {success && <div className="auth-success" role="status">{success}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: 12 }} disabled={loading}>
              {loading ? 'Verifying…' : 'Verify phone'}
            </button>
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => void handleResendPhoneCode()} disabled={loading}>
              Resend SMS code
            </button>
          </form>
        )}

        {isConfigured && !pendingPhone && <form className="auth-form" onSubmit={handleSubmit}>
          {isRegistering && <>
            <div className="form-group">
              <label className="form-label" htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                type="text"
                className="form-control"
                placeholder="Your full name"
                value={fullName}
                onChange={event => setFullName(event.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <fieldset className="form-group auth-role-selector">
              <legend className="form-label">I am registering as</legend>
              <div className="auth-role-options">
                {([
                  ['student', 'Student'],
                  ['faculty', 'Faculty'],
                  ['lab_assistant', 'Lab assistant'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`auth-role-option${role === value ? ' active' : ''}`}
                    aria-pressed={role === value}
                    onClick={() => setRole(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {role !== 'student' && <>
              {authMethod !== 'phone' && <div className="form-group">
                <label className="form-label" htmlFor="register-phone">Mobile number</label>
                <input
                  id="register-phone"
                  type="tel"
                  className="form-control"
                  placeholder="Your mobile number"
                  value={phone}
                  onChange={event => setPhone(event.target.value)}
                  required
                  autoComplete="tel"
                />
              </div>}
              <div className="form-group">
                <label className="form-label" htmlFor="register-subject">Subject taught</label>
                <input
                  id="register-subject"
                  type="text"
                  className="form-control"
                  placeholder="Subject or area"
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  required
                />
              </div>
              <p className="auth-registration-note">Staff access is enabled after an administrator approves your account.</p>
            </>}
            {role === 'student' && <>
              <div className="form-group">
                <label className="form-label" htmlFor="register-roll">Enrollment / roll number</label>
                <input id="register-roll" className="form-control" value={rollNo} onChange={event => setRollNo(event.target.value)} placeholder="Your college roll number" required maxLength={50} autoComplete="off" />
              </div>
              <div className="auth-academic-grid">
                <div className="form-group">
                  <label className="form-label" htmlFor="register-department">Department</label>
                  <select id="register-department" className="form-control" value={department} onChange={event => setDepartment(event.target.value)} required>
                    {['ENTC', 'Computer', 'Mechanical', 'Electrical', 'Civil'].map(value => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-year">Academic year</label>
                  <select id="register-year" className="form-control" value={academicYear} onChange={event => setAcademicYear(event.target.value)} required>
                    <option value="" disabled>Select year</option>
                    {[1, 2, 3, 4].map(value => <option key={value} value={value}>Year {value}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-semester">Semester</label>
                  <select id="register-semester" className="form-control" value={semester} onChange={event => setSemester(event.target.value)} required>
                    <option value="" disabled>Select semester</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(value => <option key={value} value={value}>Semester {value}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="register-batch">Batch</label>
                  <input id="register-batch" className="form-control" value={batch} onChange={event => setBatch(event.target.value)} placeholder="e.g. 2024-2028" required maxLength={50} />
                </div>
              </div>
              {authMethod === 'email' && <div className="form-group">
                <label className="form-label" htmlFor="register-student-phone">Mobile number</label>
                <input id="register-student-phone" type="tel" className="form-control" placeholder="+91 98765 43210" value={phone} onChange={event => setPhone(event.target.value)} autoComplete="tel" required />
              </div>}
              <p className="auth-registration-note">Your academic details are saved with your registration. An administrator will verify your roll number and link your student record before academic records are shown.</p>
            </>}
          </>}
          {isRegistering && (
            <fieldset className="form-group auth-role-selector">
              <legend className="form-label">Sign in with</legend>
              <div className="auth-role-options" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                {([
                  ['email', 'Email'],
                  ['phone', 'Mobile number'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`auth-role-option${authMethod === value ? ' active' : ''}`}
                    aria-pressed={authMethod === value}
                    onClick={() => { setAuthMethod(value); setError(''); }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor={isRegistering ? 'register-identifier' : 'login-identifier'}>
              {isRegistering ? authMethod === 'phone' ? 'Mobile number' : 'Email address' : 'Email or mobile number'}
            </label>
            <input
              id={isRegistering ? 'register-identifier' : 'login-identifier'}
              type={isRegistering && authMethod === 'email' ? 'email' : 'text'}
              className="form-control"
              placeholder={isRegistering ? authMethod === 'phone' ? '+91 98765 43210' : 'your@email.com' : 'your@email.com or +91 98765 43210'}
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              required
              autoComplete={isRegistering ? authMethod === 'phone' ? 'tel' : 'email' : 'username'}
            />
            {isRegistering && authMethod === 'phone' && <p className="auth-registration-note">Use an international number with country code. Indian 10-digit numbers are accepted as +91. SMS verification is required.</p>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor={isRegistering ? 'register-password' : 'login-password'}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id={isRegistering ? 'register-password' : 'login-password'}
                type={showPwd ? 'text' : 'password'}
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={isRegistering ? 6 : undefined}
                title="Use at least 6 characters."
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex' }}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {(error || authError) && <div className="auth-error">{error || authError}</div>}
          {success && <div className="auth-success" role="status">{success}</div>}

          <button id="login-submit" type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }} disabled={loading}>
            {loading ? <><span className="loading-spinner" style={{ width: 16, height: 16 }} /> {isRegistering ? 'Creating account…' : 'Signing in…'}</> : isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>}

        {isConfigured && !pendingPhone && (
          <div className="auth-switch">
            <span>{isRegistering ? 'Already registered?' : 'Not registered yet?'}</span>
            <button type="button" onClick={() => {
              setIsRegistering(value => !value);
              setError('');
              setSuccess('');
            }}>
              {isRegistering ? 'Sign in' : 'Register'}
            </button>
          </div>
        )}

        <div className="auth-footer">
          ENTC Department · Smart Lab System v1.0
        </div>
      </div>
    </div>
  );
}
