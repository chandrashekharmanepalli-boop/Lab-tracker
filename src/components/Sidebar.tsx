import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, Users, ArrowLeftRight, Shield, Activity,
  Weight, Cpu, FileBarChart, Settings, LogOut, ChevronLeft,
  ChevronRight, Menu, X, Bell, FlaskConical, ClipboardList
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../lib/utils';
import toast from 'react-hot-toast';

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: string[];
  badge?: number;
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/lab-activity', label: 'Lab Activity', icon: Activity, roles: ['admin', 'lab_assistant', 'faculty'] },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { to: '/instruments', label: 'Instruments', icon: Package, roles: ['admin', 'lab_assistant'] },
      { to: '/students', label: 'Students', icon: Users, roles: ['admin', 'lab_assistant'] },
      { to: '/transactions', label: 'Checkout / Return', icon: ArrowLeftRight, roles: ['admin', 'lab_assistant'] },
    ],
  },
  {
    label: 'Security',
    items: [
      { to: '/gate', label: 'Gate Monitor', icon: Shield, roles: ['admin', 'lab_assistant'] },
      { to: '/alerts', label: 'Unauthorized Alerts', icon: Bell, roles: ['admin', 'lab_assistant'] },
    ],
  },
  {
    label: 'Hardware',
    items: [
      { to: '/weighing', label: 'Weighing Station', icon: Weight, roles: ['admin', 'lab_assistant'] },
      { to: '/devices', label: 'Device Monitor', icon: Cpu, roles: ['admin', 'lab_assistant'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['admin', 'lab_assistant', 'faculty'] },
    ],
  },
  {
    label: 'Academics',
    items: [
      { to: '/academic-management', label: 'Academic Management', icon: ClipboardList, roles: ['admin', 'lab_assistant', 'faculty'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
  alertCount?: number;
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose, alertCount = 0 }: SidebarProps) {
  const { profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign out.');
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="mobile-overlay" onClick={onMobileClose} />
      )}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <FlaskConical size={20} color="white" />
          </div>
          {!collapsed && (
            <div className="sidebar-logo-text">
              <h1>Lab Tracker</h1>
              <span>ENTC Department</span>
            </div>
          )}
          {/* Mobile close */}
          <button
            className="btn btn-ghost btn-icon"
            style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)', display: 'none' }}
            onClick={onMobileClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>

          {/* Desktop toggle */}
          <button
            className="toggle-btn"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{ position: 'absolute', right: '-12px' }}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navSections.map(section => {
            const visibleItems = section.items.filter(item =>
              !item.roles || (role && item.roles.includes(role))
            );
            if (visibleItems.length === 0) return null;
            return (
              <div className="sidebar-section" key={section.label}>
                {!collapsed && (
                  <p className="sidebar-section-label">{section.label}</p>
                )}
                {visibleItems.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={onMobileClose}
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className="nav-item-icon" />
                    {!collapsed && <span>{item.label}</span>}
                    {!collapsed && item.to === '/alerts' && alertCount > 0 && (
                      <span className="nav-item-badge">{alertCount}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleSignOut} title="Sign out">
            <div className="avatar">
              {profile ? initials(profile.full_name) : 'U'}
            </div>
            {!collapsed && (
              <div className="sidebar-user-info">
                <p className="sidebar-user-name">{profile?.full_name ?? 'User'}</p>
                <p className="sidebar-user-role">{profile?.role ?? ''}</p>
              </div>
            )}
            {!collapsed && (
              <LogOut size={15} style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.4)' }} />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="btn btn-ghost btn-icon"
      onClick={onClick}
      aria-label="Open menu"
      style={{ display: 'none' }}
      id="mobile-menu-btn"
    >
      <Menu size={20} />
    </button>
  );
}
