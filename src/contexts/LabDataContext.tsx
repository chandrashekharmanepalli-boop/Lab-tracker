import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type {
  AuditLog,
  ComponentStock,
  CheckoutTransaction,
  GateEvent,
  HardwareDevice,
  Instrument,
  MaintenanceRecord,
  Profile,
  Student,
  UnauthorizedAlert,
  WeightReading,
  AppSetting,
} from '../types/database';
import { supabase } from '../lib/supabase';

interface LabData {
  students: Student[];
  instruments: Instrument[];
  transactions: CheckoutTransaction[];
  gateEvents: GateEvent[];
  alerts: UnauthorizedAlert[];
  components: ComponentStock[];
  weightReadings: WeightReading[];
  devices: HardwareDevice[];
  maintenanceRecords: MaintenanceRecord[];
  auditLogs: AuditLog[];
  settings: AppSetting[];
  profiles: Profile[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY_DATA: Omit<LabData, 'refresh'> = {
  students: [],
  instruments: [],
  transactions: [],
  gateEvents: [],
  alerts: [],
  components: [],
  weightReadings: [],
  devices: [],
  maintenanceRecords: [],
  auditLogs: [],
  settings: [],
  profiles: [],
  isLoading: true,
  error: null,
};

const LabDataContext = createContext<LabData | null>(null);

export function LabDataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState(EMPTY_DATA);

  const refresh = useCallback(async () => {
    const [
      studentsResult,
      instrumentsResult,
      transactionsResult,
      gateEventsResult,
      alertsResult,
      componentsResult,
      weightReadingsResult,
      devicesResult,
      maintenanceResult,
      auditLogsResult,
      settingsResult,
      profilesResult,
    ] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('instruments').select('*').order('name'),
      supabase.from('checkout_transactions').select('*').order('issue_date', { ascending: false }),
      supabase.from('gate_events').select('*').order('timestamp', { ascending: false }),
      supabase.from('unauthorized_alerts').select('*').order('created_at', { ascending: false }),
      supabase.from('component_stock').select('*').order('name'),
      supabase.from('weight_readings').select('*').order('timestamp', { ascending: false }),
      supabase.from('hardware_devices').select('*').order('name'),
      supabase.from('maintenance_records').select('*').order('performed_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }),
      supabase.from('app_settings').select('*').order('key'),
      supabase.from('profiles').select('*').order('full_name'),
    ]);

    const failure = [
      studentsResult.error,
      instrumentsResult.error,
      transactionsResult.error,
      gateEventsResult.error,
      alertsResult.error,
      componentsResult.error,
      weightReadingsResult.error,
      devicesResult.error,
      maintenanceResult.error,
      auditLogsResult.error,
      settingsResult.error,
      profilesResult.error,
    ].find(Boolean);

    if (failure) {
      setData(current => ({ ...current, isLoading: false, error: failure.message }));
      return;
    }

    const students = studentsResult.data ?? [];
    const instruments = instrumentsResult.data ?? [];
    const devices = devicesResult.data ?? [];
    const gateEvents = (gateEventsResult.data ?? []).map(event => ({
      ...event,
      instrument: instruments.find(instrument => instrument.id === event.detected_instrument_id),
      student: students.find(student => student.id === event.student_id),
    }));
    const transactions = (transactionsResult.data ?? []).map(transaction => ({
      ...transaction,
      instrument: instruments.find(instrument => instrument.id === transaction.instrument_id),
      student: students.find(student => student.id === transaction.student_id),
    }));
    const alerts = (alertsResult.data ?? []).map(alert => ({
      ...alert,
      instrument: instruments.find(instrument => instrument.id === alert.instrument_id),
      student: students.find(student => student.id === alert.student_id),
      gate_event: gateEvents.find(event => event.id === alert.gate_event_id),
    }));
    const components = componentsResult.data ?? [];

    setData({
      students,
      instruments,
      transactions,
      gateEvents,
      alerts,
      components,
      weightReadings: (weightReadingsResult.data ?? []).map(reading => ({
        ...reading,
        component: components.find(component => component.id === reading.component_id),
      })),
      devices,
      maintenanceRecords: (maintenanceResult.data ?? []).map(record => ({
        ...record,
        instrument: instruments.find(instrument => instrument.id === record.instrument_id),
      })),
      auditLogs: auditLogsResult.data ?? [],
      settings: settingsResult.data ?? [],
      profiles: profilesResult.data ?? [],
      isLoading: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase.channel('lab-tracker-live-data');
    const tables = [
      'students',
      'instruments',
      'checkout_transactions',
      'gate_events',
      'unauthorized_alerts',
      'component_stock',
      'weight_readings',
      'hardware_devices',
      'maintenance_records',
      'audit_logs',
      'app_settings',
      'profiles',
    ] as const;

    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        void refresh();
      });
    }

    channel.subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setData(current => ({
          ...current,
          error: `Real-time connection ${status === 'TIMED_OUT' ? 'timed out' : 'failed'}. Check your Supabase Realtime and network configuration.`,
        }));
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo(() => ({ ...data, refresh }), [data, refresh]);
  return <LabDataContext.Provider value={value}>{children}</LabDataContext.Provider>;
}

export function useLabData() {
  const context = useContext(LabDataContext);
  if (!context) throw new Error('useLabData must be used inside LabDataProvider');
  return context;
}
