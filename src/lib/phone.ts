export function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  if (trimmed.startsWith('+') && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  if (/^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  return null;
}
