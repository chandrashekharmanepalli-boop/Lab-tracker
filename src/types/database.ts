// ─── Database Type Definitions ───────────────────────────────────────────────
// Mirrors the Supabase PostgreSQL schema

export type UserRole = 'admin' | 'faculty' | 'lab_assistant' | 'student';
export type InstrumentStatus = 'available' | 'borrowed' | 'repair' | 'missing' | 'archived';
export type InstrumentCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type TransactionStatus = 'active' | 'returned' | 'overdue';
export type GateDirection = 'entry' | 'exit';
export type DeviceStatus = 'online' | 'offline' | 'error';
export type DeviceType = 'rfid_gate' | 'inventory_rfid' | 'weighing_station' | 'multi';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string;
  role: UserRole;
  phone: string | null;
  subject: string | null;
  student_roll_no: string | null;
  department: string | null;
  academic_year: number | null;
  semester: number | null;
  batch: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  profile_id: string | null;
  name: string;
  roll_no: string;
  department: string;
  year: number;
  semester: number | null;
  batch: string;
  rfid_uid: string | null;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Instrument {
  id: string;
  name: string;
  instrument_id: string;  // unique human-readable ID e.g. "INST-001"
  rfid_uid: string | null;
  category: string;
  location: string;
  description: string | null;
  status: InstrumentStatus;
  condition: InstrumentCondition;
  purchase_date: string | null;
  purchase_cost: number | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutTransaction {
  id: string;
  instrument_id: string;
  student_id: string;
  issued_by: string;   // profile id
  issue_date: string;
  expected_return: string;
  returned_at: string | null;
  returned_verified_by: string | null;
  status: TransactionStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  instrument?: Instrument;
  student?: Student;
  issued_by_profile?: Profile;
}

export interface GateEvent {
  id: string;
  device_id: string;
  rfid_uid: string | null;
  detected_instrument_id: string | null;
  direction: GateDirection;
  authorized: boolean;
  student_id: string | null;
  sensor1_triggered: boolean;
  sensor2_triggered: boolean;
  timestamp: string;
  raw_payload: Record<string, unknown> | null;
  // joined
  instrument?: Instrument;
  student?: Student;
}

export interface UnauthorizedAlert {
  id: string;
  gate_event_id: string;
  instrument_id: string | null;
  student_id: string | null;
  severity: 'low' | 'medium' | 'high';
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  notes: string | null;
  created_at: string;
  // joined
  gate_event?: GateEvent;
  instrument?: Instrument;
  student?: Student;
}

export interface ComponentStock {
  id: string;
  name: string;
  category: string;
  unit_weight_g: number | null;
  quantity_per_100g: number | null;
  current_quantity: number;
  low_stock_threshold: number;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WeightReading {
  id: string;
  device_id: string;
  component_id: string | null;
  raw_weight_g: number;
  tare_weight_g: number;
  net_weight_g: number;
  estimated_quantity: number | null;
  calibration_factor: number;
  timestamp: string;
  // joined
  component?: ComponentStock;
}

export interface HardwareDevice {
  id: string;
  name: string;
  device_id: string;   // unique hardware identifier
  type: DeviceType;
  location: string;
  firmware_version: string | null;
  ip_address: string | null;
  mac_address: string | null;
  status: DeviceStatus;
  last_heartbeat: string | null;
  last_event: string | null;
  wifi_rssi: number | null;
  error_message: string | null;
  config: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRecord {
  id: string;
  instrument_id: string;
  description: string;
  performed_by: string | null;
  performed_at: string;
  cost: number | null;
  next_maintenance_date: string | null;
  created_at: string;
  // joined
  instrument?: Instrument;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_by: string | null;
  updated_at: string;
}

export interface PracticalExperiment {
  id: string;
  subject: string;
  experiment_number: string;
  name: string;
  instructions: string;
  semester: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface StudentExperiment {
  id: string;
  student_id: string;
  experiment_id: string;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_by: string | null;
  assigned_at: string;
  due_at: string | null;
  report_due_at: string | null;
  experiment?: PracticalExperiment;
}

export interface StudentExperimentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  submission_type: 'result' | 'report';
  file_path: string;
  notes: string;
  submitted_at: string;
}

export interface StudentExperimentEvaluation {
  assignment_id: string;
  student_id: string;
  marks: number;
  max_marks: number;
  remarks: string;
  feedback_file_path: string | null;
  evaluated_by: string | null;
  evaluated_at: string;
}

export interface LabAttendance {
  id: string;
  student_id: string;
  attendance_date: string;
  subject: string;
  status: 'present' | 'absent' | 'late';
  remarks: string | null;
  recorded_by: string | null;
  created_at: string;
}

export type EquipmentBookingStatus = 'pending' | 'approved' | 'rejected' | 'issued' | 'returned' | 'cancelled';

export interface EquipmentBooking {
  id: string;
  student_id: string;
  instrument_id: string;
  requested_at: string;
  needed_until: string;
  purpose: string;
  status: EquipmentBookingStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  issued_at: string | null;
  returned_at: string | null;
  created_at: string;
}

export interface EquipmentDamageReport {
  id: string;
  student_id: string;
  instrument_id: string | null;
  booking_id: string | null;
  description: string;
  status: 'open' | 'reviewing' | 'resolved';
  resolution: string | null;
  reported_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface LabSession {
  id: string;
  subject: string;
  faculty_name: string;
  laboratory: string;
  starts_at: string;
  ends_at: string;
  department: string;
  target_year: number | null;
  target_semester: number | null;
  target_batch: string | null;
  change_notice: string | null;
  created_by: string | null;
  created_at: string;
}

export type AnnouncementCategory = 'general' | 'practical_exam' | 'deadline' | 'maintenance' | 'equipment';

export interface DepartmentAnnouncement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  department: string;
  target_year: number | null;
  target_semester: number | null;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

// Database generic type for Supabase client
type TableDefinition<Row, Insert, Update> = {
  Row: Row & Record<string, unknown>;
  Insert: Insert & Record<string, unknown>;
  Update: Update & Record<string, unknown>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<Profile, Omit<Profile, 'created_at' | 'updated_at'>, Partial<Profile>>;
      students: TableDefinition<
        Student,
        Omit<Student, 'id' | 'created_at' | 'updated_at' | 'profile_id' | 'semester'> & {
          profile_id?: string | null;
          semester?: number | null;
        },
        Partial<Student>
      >;
      instruments: TableDefinition<Instrument, Omit<Instrument, 'id' | 'created_at' | 'updated_at'>, Partial<Instrument>>;
      checkout_transactions: TableDefinition<CheckoutTransaction, Omit<CheckoutTransaction, 'id' | 'created_at' | 'updated_at'>, Partial<CheckoutTransaction>>;
      gate_events: TableDefinition<GateEvent, Omit<GateEvent, 'id'>, Partial<GateEvent>>;
      unauthorized_alerts: TableDefinition<UnauthorizedAlert, Omit<UnauthorizedAlert, 'id' | 'created_at'>, Partial<UnauthorizedAlert>>;
      component_stock: TableDefinition<ComponentStock, Omit<ComponentStock, 'id' | 'created_at' | 'updated_at'>, Partial<ComponentStock>>;
      weight_readings: TableDefinition<WeightReading, Omit<WeightReading, 'id'>, Partial<WeightReading>>;
      hardware_devices: TableDefinition<HardwareDevice, Omit<HardwareDevice, 'id' | 'created_at' | 'updated_at'>, Partial<HardwareDevice>>;
      maintenance_records: TableDefinition<MaintenanceRecord, Omit<MaintenanceRecord, 'id' | 'created_at'>, Partial<MaintenanceRecord>>;
      audit_logs: TableDefinition<AuditLog, Omit<AuditLog, 'id'>, Partial<AuditLog>>;
      app_settings: TableDefinition<AppSetting, Omit<AppSetting, 'updated_at'>, Partial<AppSetting>>;
      practical_experiments: TableDefinition<PracticalExperiment, Omit<PracticalExperiment, 'id' | 'created_at'>, Partial<PracticalExperiment>>;
      student_experiments: TableDefinition<StudentExperiment, Omit<StudentExperiment, 'id' | 'assigned_at' | 'experiment'>, Partial<StudentExperiment>>;
      student_experiment_submissions: TableDefinition<StudentExperimentSubmission, Omit<StudentExperimentSubmission, 'id' | 'submitted_at'>, Partial<StudentExperimentSubmission>>;
      student_experiment_evaluations: TableDefinition<StudentExperimentEvaluation, Omit<StudentExperimentEvaluation, 'evaluated_at'>, Partial<StudentExperimentEvaluation>>;
      lab_attendance: TableDefinition<LabAttendance, Omit<LabAttendance, 'id' | 'created_at'>, Partial<LabAttendance>>;
      equipment_bookings: TableDefinition<
        EquipmentBooking,
        Omit<EquipmentBooking, 'id' | 'requested_at' | 'created_at' | 'reviewed_by' | 'reviewed_at' | 'issued_at' | 'returned_at'> &
          Partial<Pick<EquipmentBooking, 'reviewed_by' | 'reviewed_at' | 'issued_at' | 'returned_at'>>,
        Partial<EquipmentBooking>
      >;
      equipment_damage_reports: TableDefinition<
        EquipmentDamageReport,
        Omit<EquipmentDamageReport, 'id' | 'reported_at' | 'resolution' | 'reviewed_by' | 'reviewed_at'> &
          Partial<Pick<EquipmentDamageReport, 'resolution' | 'reviewed_by' | 'reviewed_at'>>,
        Partial<EquipmentDamageReport>
      >;
      lab_sessions: TableDefinition<LabSession, Omit<LabSession, 'id' | 'created_at'>, Partial<LabSession>>;
      department_announcements: TableDefinition<DepartmentAnnouncement, Omit<DepartmentAnnouncement, 'id' | 'created_at' | 'published_at'>, Partial<DepartmentAnnouncement>>;
    };
    Views: Record<string, never>;
    Functions: {
      issue_instrument: {
        Args: {
          p_student_id: string;
          p_instrument_id: string;
          p_expected_return: string;
          p_notes?: string;
        };
        Returns: CheckoutTransaction;
      };
      return_instrument: {
        Args: { p_transaction_id: string };
        Returns: CheckoutTransaction;
      };
      link_student_account: {
        Args: { p_student_id: string; p_profile_id: string };
        Returns: string;
      };
      get_lab_hours: {
        Args: Record<string, never>;
        Returns: Record<string, unknown> | null;
      };
      submit_student_experiment: {
        Args: { p_assignment_id: string; p_submission_type: 'result' | 'report'; p_file_path: string; p_notes?: string };
        Returns: string;
      };
      evaluate_student_experiment: {
        Args: { p_assignment_id: string; p_marks: number; p_max_marks: number; p_remarks?: string; p_feedback_file_path?: string | null };
        Returns: undefined;
      };
      request_student_equipment: {
        Args: { p_instrument_id: string; p_needed_until: string; p_purpose: string };
        Returns: string;
      };
    };
    Enums: {
      user_role: UserRole;
      instrument_status: InstrumentStatus;
      instrument_condition: InstrumentCondition;
      transaction_status: TransactionStatus;
      gate_direction: GateDirection;
      device_status: DeviceStatus;
      device_type: DeviceType;
    };
    CompositeTypes: Record<string, never>;
  };
}
