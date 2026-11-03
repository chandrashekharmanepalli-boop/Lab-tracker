-- Lab Tracker database schema.
-- Apply once in the Supabase SQL Editor for a new project.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'faculty', 'lab_assistant', 'student');
create type public.instrument_status as enum ('available', 'borrowed', 'repair', 'missing', 'archived');
create type public.instrument_condition as enum ('excellent', 'good', 'fair', 'poor');
create type public.transaction_status as enum ('active', 'returned', 'overdue');
create type public.gate_direction as enum ('entry', 'exit');
create type public.device_status as enum ('online', 'offline', 'error');
create type public.device_type as enum ('rfid_gate', 'inventory_rfid', 'weighing_station', 'multi');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text not null,
  role public.user_role not null default 'student',
  phone text,
  subject text,
  student_roll_no text,
  department text,
  academic_year smallint check (academic_year between 1 and 8),
  semester smallint check (semester between 1 and 8),
  batch text,
  is_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  name text not null,
  roll_no text not null unique,
  department text not null,
  year integer not null check (year between 1 and 8),
  semester smallint check (semester between 1 and 8),
  batch text not null,
  rfid_uid text unique,
  email text,
  phone text,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.instruments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  instrument_id text not null unique,
  rfid_uid text unique,
  category text not null,
  location text not null,
  description text,
  status public.instrument_status not null default 'available',
  condition public.instrument_condition not null default 'good',
  purchase_date date,
  purchase_cost numeric(12, 2) check (purchase_cost is null or purchase_cost >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.checkout_transactions (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id),
  student_id uuid not null references public.students (id),
  issued_by uuid not null references public.profiles (id),
  issue_date timestamptz not null default now(),
  expected_return timestamptz not null,
  returned_at timestamptz,
  returned_verified_by uuid references public.profiles (id),
  status public.transaction_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expected_return >= issue_date),
  check ((status = 'returned') = (returned_at is not null))
);

create table public.hardware_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  device_id text not null unique,
  type public.device_type not null,
  location text not null,
  firmware_version text,
  ip_address inet,
  mac_address text,
  status public.device_status not null default 'offline',
  last_heartbeat timestamptz,
  last_event timestamptz,
  wifi_rssi integer,
  error_message text,
  config jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gate_events (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hardware_devices (id),
  rfid_uid text,
  detected_instrument_id uuid references public.instruments (id),
  direction public.gate_direction not null,
  authorized boolean not null default false,
  student_id uuid references public.students (id),
  sensor1_triggered boolean not null default false,
  sensor2_triggered boolean not null default false,
  timestamp timestamptz not null default now(),
  raw_payload jsonb
);

create table public.unauthorized_alerts (
  id uuid primary key default gen_random_uuid(),
  gate_event_id uuid not null references public.gate_events (id),
  instrument_id uuid references public.instruments (id),
  student_id uuid references public.students (id),
  severity text not null check (severity in ('low', 'medium', 'high')),
  acknowledged boolean not null default false,
  acknowledged_by uuid references public.profiles (id),
  acknowledged_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check ((acknowledged = true) = (acknowledged_at is not null))
);

create table public.component_stock (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  unit_weight_g numeric(12, 4) check (unit_weight_g is null or unit_weight_g > 0),
  quantity_per_100g numeric(12, 2),
  current_quantity integer not null default 0 check (current_quantity >= 0),
  low_stock_threshold integer not null default 0 check (low_stock_threshold >= 0),
  location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.weight_readings (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.hardware_devices (id),
  component_id uuid references public.component_stock (id),
  raw_weight_g numeric(12, 4) not null,
  tare_weight_g numeric(12, 4) not null default 0,
  net_weight_g numeric(12, 4) not null,
  estimated_quantity integer,
  calibration_factor numeric(12, 6) not null default 1,
  timestamp timestamptz not null default now()
);

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id),
  description text not null,
  performed_by uuid references public.profiles (id),
  performed_at timestamptz not null default now(),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  next_maintenance_date date,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id),
  action text not null,
  table_name text not null,
  record_id text,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  timestamp timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

create index checkout_transactions_status_idx on public.checkout_transactions (status);
create index checkout_transactions_student_idx on public.checkout_transactions (student_id);
create index checkout_transactions_instrument_idx on public.checkout_transactions (instrument_id);
create index gate_events_timestamp_idx on public.gate_events (timestamp desc);
create index unauthorized_alerts_created_idx on public.unauthorized_alerts (created_at desc);
create index weight_readings_timestamp_idx on public.weight_readings (timestamp desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.guard_student_profile_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.profile_id is not null and not public.is_lab_admin() then
      raise exception 'Only an administrator can link a student account';
    end if;
  elsif new.profile_id is distinct from old.profile_id
    and not public.is_lab_admin() then
    raise exception 'Only an administrator can link a student account';
  end if;
  return new;
end;
$$;

create trigger guard_student_profile_link
  before insert or update on public.students
  for each row execute function public.guard_student_profile_link();

create trigger set_students_updated_at before update on public.students
  for each row execute function public.set_updated_at();
create trigger set_instruments_updated_at before update on public.instruments
  for each row execute function public.set_updated_at();
create trigger set_checkout_transactions_updated_at before update on public.checkout_transactions
  for each row execute function public.set_updated_at();
create trigger set_component_stock_updated_at before update on public.component_stock
  for each row execute function public.set_updated_at();
create trigger set_hardware_devices_updated_at before update on public.hardware_devices
  for each row execute function public.set_updated_at();
create trigger set_app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_role public.user_role;
  selected_roll_no text;
  selected_department text;
  selected_year smallint;
  selected_semester smallint;
  selected_batch text;
  selected_name text;
  selected_phone text;
begin
  selected_role := case
    when new.raw_user_meta_data ->> 'role' = 'faculty' then 'faculty'::public.user_role
    when new.raw_user_meta_data ->> 'role' = 'lab_assistant' then 'lab_assistant'::public.user_role
    else 'student'::public.user_role
  end;
  selected_roll_no := nullif(btrim(new.raw_user_meta_data ->> 'roll_no'), '');
  selected_department := nullif(btrim(new.raw_user_meta_data ->> 'department'), '');
  selected_batch := nullif(btrim(new.raw_user_meta_data ->> 'batch'), '');
  selected_name := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, new.phone);
  selected_phone := coalesce(nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''), new.phone);

  if new.raw_user_meta_data ->> 'year' ~ '^[1-8]$' then
    selected_year := (new.raw_user_meta_data ->> 'year')::smallint;
  end if;
  if new.raw_user_meta_data ->> 'semester' ~ '^[1-8]$' then
    selected_semester := (new.raw_user_meta_data ->> 'semester')::smallint;
  end if;

  insert into public.profiles (
    id, email, full_name, role, phone, subject, is_approved,
    student_roll_no, department, academic_year, semester, batch
  )
  values (
    new.id,
    new.email,
    selected_name,
    selected_role,
    selected_phone,
    nullif(new.raw_user_meta_data ->> 'subject', ''),
    selected_role not in ('faculty', 'lab_assistant'),
    case when selected_role = 'student' then selected_roll_no end,
    case when selected_role = 'student' then selected_department end,
    case when selected_role = 'student' then selected_year end,
    case when selected_role = 'student' then selected_semester end,
    case when selected_role = 'student' then selected_batch end
  )
  on conflict (id) do nothing;

  if selected_role = 'student'
    and selected_roll_no is not null
    and selected_department is not null
    and selected_year between 1 and 4
    and selected_semester between 1 and 8
    and selected_batch is not null
  then
    insert into public.students (
      name, roll_no, department, year, semester, batch, email, phone
    )
    values (
      selected_name, selected_roll_no, selected_department, selected_year,
      selected_semester, selected_batch, new.email, selected_phone
    )
    on conflict (roll_no) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

create or replace function public.log_lab_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb;
  new_record jsonb;
  changed_id text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    old_record = to_jsonb(old);
    changed_id = coalesce(old_record ->> 'id', old_record ->> 'key');
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    new_record = to_jsonb(new);
    changed_id = coalesce(new_record ->> 'id', new_record ->> 'key');
  end if;

  insert into public.audit_logs (user_id, action, table_name, record_id, old_values, new_values)
  values ((select auth.uid()), tg_op, tg_table_name, changed_id, old_record, new_record);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger audit_students after insert or update or delete on public.students
  for each row execute function public.log_lab_change();
create trigger audit_instruments after insert or update or delete on public.instruments
  for each row execute function public.log_lab_change();
create trigger audit_checkout_transactions after insert or update or delete on public.checkout_transactions
  for each row execute function public.log_lab_change();
create trigger audit_hardware_devices after insert or update or delete on public.hardware_devices
  for each row execute function public.log_lab_change();
create trigger audit_gate_events after insert or update or delete on public.gate_events
  for each row execute function public.log_lab_change();
create trigger audit_unauthorized_alerts after insert or update or delete on public.unauthorized_alerts
  for each row execute function public.log_lab_change();
create trigger audit_component_stock after insert or update or delete on public.component_stock
  for each row execute function public.log_lab_change();
create trigger audit_weight_readings after insert or update or delete on public.weight_readings
  for each row execute function public.log_lab_change();
create trigger audit_maintenance_records after insert or update or delete on public.maintenance_records
  for each row execute function public.log_lab_change();
create trigger audit_app_settings after insert or update or delete on public.app_settings
  for each row execute function public.log_lab_change();

create or replace function public.is_lab_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and (role = 'admin' or (role = 'lab_assistant' and is_approved))
  );
$$;

create or replace function public.is_lab_faculty()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'faculty'
      and is_approved
  );
$$;

create or replace function public.is_lab_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

create or replace function public.link_student_account(p_student_id uuid, p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_lab_admin() then
    raise exception 'Only an administrator can link student accounts';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_profile_id and role = 'student'
  ) then
    raise exception 'The selected account is not a student account';
  end if;

  if exists (
    select 1 from public.students
    where profile_id = p_profile_id and id <> p_student_id
  ) then
    raise exception 'This account is already linked to another student';
  end if;

  update public.students
  set profile_id = p_profile_id
  where id = p_student_id
    and is_active
    and (profile_id is null or profile_id = p_profile_id);

  if not found then
    raise exception 'The student record is inactive, missing, or already linked';
  end if;

  return p_student_id;
end;
$$;

revoke all on function public.link_student_account(uuid, uuid) from public, anon;
grant execute on function public.link_student_account(uuid, uuid) to authenticated;

create or replace function public.get_lab_hours()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select value -> 'labHours'
  from public.app_settings
  where key = 'general';
$$;

revoke all on function public.get_lab_hours() from public, anon;
grant execute on function public.get_lab_hours() to authenticated;

create or replace function public.issue_instrument(
  p_student_id uuid,
  p_instrument_id uuid,
  p_expected_return timestamptz,
  p_notes text default null
)
returns public.checkout_transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_instrument public.instruments;
  new_transaction public.checkout_transactions;
begin
  if not public.is_lab_staff() then
    raise exception 'Lab staff access is required to issue instruments';
  end if;

  select * into selected_instrument
  from public.instruments
  where id = p_instrument_id
  for update;

  if not found then
    raise exception 'Instrument not found';
  end if;
  if selected_instrument.status <> 'available' then
    raise exception 'Instrument is not available';
  end if;
  if not exists (
    select 1
    from public.students
    where id = p_student_id and is_active
  ) then
    raise exception 'Active student not found';
  end if;
  if p_expected_return <= now() then
    raise exception 'Expected return date must be in the future';
  end if;

  insert into public.checkout_transactions (
    instrument_id, student_id, issued_by, expected_return, notes, status
  )
  values (
    p_instrument_id, p_student_id, (select auth.uid()), p_expected_return, p_notes, 'active'
  )
  returning * into new_transaction;

  update public.instruments
  set status = 'borrowed'
  where id = p_instrument_id;

  return new_transaction;
end;
$$;

create or replace function public.return_instrument(p_transaction_id uuid)
returns public.checkout_transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_transaction public.checkout_transactions;
begin
  if not public.is_lab_staff() then
    raise exception 'Lab staff access is required to return instruments';
  end if;

  select * into selected_transaction
  from public.checkout_transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction not found';
  end if;
  if selected_transaction.status = 'returned' then
    raise exception 'Instrument has already been returned';
  end if;

  update public.checkout_transactions
  set status = 'returned',
      returned_at = now(),
      returned_verified_by = (select auth.uid())
  where id = p_transaction_id
  returning * into selected_transaction;

  if not exists (
    select 1
    from public.checkout_transactions
    where instrument_id = selected_transaction.instrument_id
      and status in ('active', 'overdue')
  ) then
    update public.instruments
    set status = 'available'
    where id = selected_transaction.instrument_id
      and status = 'borrowed';
  end if;

  return selected_transaction;
end;
$$;

revoke all on function public.issue_instrument(uuid, uuid, timestamptz, text) from public, anon;
revoke all on function public.return_instrument(uuid) from public, anon;
grant execute on function public.issue_instrument(uuid, uuid, timestamptz, text) to authenticated;
grant execute on function public.return_instrument(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.instruments enable row level security;
alter table public.checkout_transactions enable row level security;
alter table public.hardware_devices enable row level security;
alter table public.gate_events enable row level security;
alter table public.unauthorized_alerts enable row level security;
alter table public.component_stock enable row level security;
alter table public.weight_readings enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

create policy "Users read own or staff profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_lab_staff()));
create policy "Admins manage profiles" on public.profiles
  for all to authenticated
  using ((select public.is_lab_admin()))
  with check ((select public.is_lab_admin()));

create policy "Lab staff read audit logs" on public.audit_logs
  for select to authenticated
  using ((select public.is_lab_staff()));
create policy "Faculty read audit logs" on public.audit_logs
  for select to authenticated
  using ((select public.is_lab_faculty()));
create policy "Students read their linked record" on public.students
  for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "Students read their checkouts" on public.checkout_transactions
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = checkout_transactions.student_id
      and students.profile_id = (select auth.uid())
  ));
create policy "Students read instruments they checked out" on public.instruments
  for select to authenticated
  using (exists (
    select 1
    from public.checkout_transactions
    join public.students on students.id = checkout_transactions.student_id
    where checkout_transactions.instrument_id = instruments.id
      and students.profile_id = (select auth.uid())
  ));
create policy "Students read their gate events" on public.gate_events
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = gate_events.student_id
      and students.profile_id = (select auth.uid())
  ));
create policy "Students read their alerts" on public.unauthorized_alerts
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = unauthorized_alerts.student_id
      and students.profile_id = (select auth.uid())
  ));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'students', 'instruments', 'checkout_transactions', 'hardware_devices',
    'gate_events', 'unauthorized_alerts', 'component_stock', 'weight_readings',
    'maintenance_records', 'app_settings'
  ]
  loop
    execute format(
      'create policy "Lab staff manage %1$s" on public.%1$I for all to authenticated using ((select public.is_lab_staff())) with check ((select public.is_lab_staff()))',
      table_name
    );
    execute format(
      'create policy "Faculty read %1$s" on public.%1$I for select to authenticated using ((select public.is_lab_faculty()))',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'students', 'instruments', 'checkout_transactions',
    'hardware_devices', 'gate_events', 'unauthorized_alerts',
    'component_stock', 'weight_readings', 'maintenance_records', 'audit_logs',
    'app_settings'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
