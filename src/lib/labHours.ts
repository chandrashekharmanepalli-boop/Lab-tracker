export const WEEKDAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
] as const;

export type Weekday = typeof WEEKDAYS[number]['key'];
export interface DayHours {
  open: boolean;
  opens: string;
  closes: string;
}
export type LabHours = Record<Weekday, DayHours>;

export const DEFAULT_LAB_HOURS: LabHours = {
  monday: { open: false, opens: '09:00', closes: '17:00' },
  tuesday: { open: false, opens: '09:00', closes: '17:00' },
  wednesday: { open: false, opens: '09:00', closes: '17:00' },
  thursday: { open: false, opens: '09:00', closes: '17:00' },
  friday: { open: false, opens: '09:00', closes: '17:00' },
  saturday: { open: false, opens: '09:00', closes: '17:00' },
  sunday: { open: false, opens: '09:00', closes: '17:00' },
};

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function readLabHours(value: unknown): LabHours | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const hours = {} as LabHours;

  for (const { key } of WEEKDAYS) {
    const day = record[key];
    if (typeof day !== 'object' || day === null || Array.isArray(day)) return null;
    const values = day as Record<string, unknown>;
    if (typeof values.open !== 'boolean' || !isTime(values.opens) || !isTime(values.closes)) return null;
    hours[key] = { open: values.open, opens: values.opens, closes: values.closes };
  }

  return hours;
}
