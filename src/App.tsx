import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, RequireRole, useAuth } from './contexts/AuthContext';
import { LabDataProvider, useLabData } from './contexts/LabDataContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InstrumentsPage from './pages/InstrumentsPage';
import StudentsPage from './pages/StudentsPage';
import TransactionsPage from './pages/TransactionsPage';
import GatePage from './pages/GatePage';
import AlertsPage from './pages/AlertsPage';
import WeighingPage from './pages/WeighingPage';
import DevicesPage from './pages/DevicesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import LabActivityPage from './pages/LabActivityPage';
import StudentDashboardPage from './pages/StudentDashboardPage';
import AcademicManagementPage from './pages/AcademicManagementPage';

import './index.css';
import 'react-hot-toast';

// ─── Page titles per route ─────────────────────────────────────────────────
const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard':    { title: 'Dashboard', subtitle: 'Lab overview & live status' },
  '/lab-activity': { title: 'Lab Activity', subtitle: 'Component stock, transactions, alerts, and audit history' },
  '/instruments':  { title: 'Instruments', subtitle: 'Manage lab equipment inventory' },
  '/students':     { title: 'Students', subtitle: 'Registered student directory' },
  '/transactions': { title: 'Checkout / Return', subtitle: 'Issue and return instruments' },
  '/gate':         { title: 'Gate Monitor', subtitle: 'Exit gate & anti-theft monitoring' },
  '/alerts':       { title: 'Unauthorized Alerts', subtitle: 'Security & alert history' },
  '/weighing':     { title: 'Weighing Station', subtitle: 'Electronic component stock by weight' },
  '/devices':      { title: 'Device Monitor', subtitle: 'ESP32 hardware status & heartbeats' },
  '/reports':      { title: 'Reports', subtitle: 'Analytics, exports & audit logs' },
  '/settings':     { title: 'Settings', subtitle: 'System configuration & user management' },
  '/academic-management': { title: 'Academic Management', subtitle: 'Practical work, attendance, equipment, and department updates' },
};

// ─── Protected Layout ──────────────────────────────────────────────────────
function AppLayout() {
  const { profile, role } = useAuth();
  const { alerts, error, isLoading, refresh } = useLabData();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPath = window.location.pathname;
  const meta = PAGE_META[currentPath] ?? { title: 'Lab Tracker' };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--gray-50)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Connecting to live lab data…</p>
        </div>
      </div>
    );
  }

  if (!profile) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        alertCount={alerts.filter(alert => !alert.acknowledged).length}
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          title={meta.title}
          subtitle={meta.subtitle}
          onMobileMenuOpen={() => setMobileOpen(true)}
          alertCount={alerts.filter(alert => !alert.acknowledged).length}
          onRefresh={() => void refresh()}
        />

        <div className="page-wrapper">
          {error && (
            <div className="alert alert-danger" role="alert" style={{ marginBottom: 16 }}>
              <span>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => void refresh()}>Retry</button>
            </div>
          )}
          <Routes>
            <Route path="/dashboard"    element={role === 'student' ? <StudentDashboardPage /> : <DashboardPage />} />
            <Route path="/lab-activity" element={<RequireRole roles={['admin', 'lab_assistant', 'faculty']}><LabActivityPage /></RequireRole>} />
            <Route path="/instruments"  element={<RequireRole roles={['admin', 'lab_assistant']}><InstrumentsPage /></RequireRole>} />
            <Route path="/students"     element={<RequireRole roles={['admin', 'lab_assistant']}><StudentsPage /></RequireRole>} />
            <Route path="/transactions" element={<RequireRole roles={['admin', 'lab_assistant']}><TransactionsPage /></RequireRole>} />
            <Route path="/gate"         element={<RequireRole roles={['admin', 'lab_assistant']}><GatePage /></RequireRole>} />
            <Route path="/alerts"       element={<RequireRole roles={['admin', 'lab_assistant']}><AlertsPage /></RequireRole>} />
            <Route path="/weighing"     element={<RequireRole roles={['admin', 'lab_assistant']}><WeighingPage /></RequireRole>} />
            <Route path="/devices"      element={<RequireRole roles={['admin', 'lab_assistant']}><DevicesPage /></RequireRole>} />
            <Route path="/reports"      element={<RequireRole roles={['admin', 'lab_assistant', 'faculty']}><ReportsPage /></RequireRole>} />
            <Route path="/settings"     element={<RequireRole roles={['admin']}><SettingsPage /></RequireRole>} />
            <Route path="/academic-management" element={<RequireRole roles={['admin', 'lab_assistant', 'faculty']}><AcademicManagementPage /></RequireRole>} />
            <Route path="*"             element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function StartupSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 2600);
    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!visible) return null;

  return (
    <div className="startup-splash" role="status" aria-label="BIT Lab Tracker is starting">
      <div className="startup-splash__content">
        <div className="startup-splash__logo-wrap">
          <span className="startup-splash__orbit startup-splash__orbit--outer" />
          <span className="startup-splash__orbit startup-splash__orbit--inner" />
          <img className="startup-splash__logo" src="/bit-logo.png" alt="BIT — The Knowledge World" />
        </div>
        <p className="startup-splash__wordmark">BIT <span>LAB TRACKER</span></p>
        <p className="startup-splash__tagline">The Knowledge World</p>
        <div className="startup-splash__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function BackendSetupNotice() {
  return (
    <main className="auth-page">
      <section className="auth-card" role="alert">
        <div className="auth-logo">
          <h1>Supabase setup required</h1>
          <p>This app needs a real Supabase project to sign in and load live lab data.</p>
        </div>
        <ol style={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, paddingLeft: 22 }}>
          <li>Create a Supabase project.</li>
          <li>Run <code>supabase/schema.sql</code> in its SQL Editor.</li>
          <li>Put the project URL and public anon key in the local <code>.env</code>.</li>
          <li>Restart the development server.</li>
        </ol>
        <p className="auth-footer">See README.md for the full setup instructions.</p>
      </section>
    </main>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <StartupSplash />
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              borderRadius: '10px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*"     element={<ProtectedApp />} />
    </Routes>
  );
}

function ProtectedApp() {
  const { profile, role, isConfigured, isLoading } = useAuth();

  if (!isConfigured) return <BackendSetupNotice />;
  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  if ((role === 'faculty' || role === 'lab_assistant') && !profile.is_approved) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Approval pending</h1>
          <p>Your {role === 'faculty' ? 'faculty' : 'lab assistant'} account is waiting for an administrator to approve staff access.</p>
          <p>Once approved, check again to continue.</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Check approval
          </button>
        </div>
      </div>
    );
  }
  if (role !== 'admin' && role !== 'lab_assistant' && role !== 'faculty' && role !== 'student') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Staff access required</h1>
          <p>Ask a lab administrator to assign your account a lab staff role.</p>
        </div>
      </div>
    );
  }

  return (
    <LabDataProvider>
      <AppLayout />
    </LabDataProvider>
  );
}
