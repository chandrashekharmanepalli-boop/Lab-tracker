import { Bell, Menu, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMobileMenuOpen: () => void;
  alertCount?: number;
  onRefresh?: () => void;
}

export default function Header({ title, subtitle, onMobileMenuOpen, alertCount = 0, onRefresh }: HeaderProps) {
  const { role } = useAuth();
  const activityPath = role === 'student' ? '/dashboard' : '/lab-activity';
  return (
    <header className="header">
      <button
        className="btn btn-ghost btn-icon"
        onClick={onMobileMenuOpen}
        aria-label="Open menu"
        id="mobile-menu-btn"
        style={{ display: 'none' }}
      >
        <Menu size={20} />
      </button>

      <div className="header-title">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="header-actions">
        {onRefresh && (
          <button className="header-btn" onClick={onRefresh} title="Refresh">
            <RefreshCw size={16} />
          </button>
        )}

        <Link className="header-btn" to={activityPath} title={role === 'student' ? 'Student dashboard' : 'Lab activity and notifications'} aria-label={role === 'student' ? 'Student dashboard' : 'Lab activity and notifications'}>
          <Bell size={16} />
          {role !== 'student' && alertCount > 0 && <span className="badge-dot" />}
        </Link>
      </div>
    </header>
  );
}
