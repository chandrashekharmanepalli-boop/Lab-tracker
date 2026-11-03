import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy, HH:mm');
  } catch {
    return dateStr;
  }
}

export function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'HH:mm:ss');
  } catch {
    return dateStr;
  }
}

export function isOverdue(expectedReturn: string | null | undefined): boolean {
  if (!expectedReturn) return false;
  try {
    return parseISO(expectedReturn) < new Date();
  } catch {
    return false;
  }
}

export function isStale(lastHeartbeat: string | null | undefined, thresholdMs = 60000): boolean {
  if (!lastHeartbeat) return true;
  try {
    return Date.now() - parseISO(lastHeartbeat).getTime() > thresholdMs;
  } catch {
    return true;
  }
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

export function truncate(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
