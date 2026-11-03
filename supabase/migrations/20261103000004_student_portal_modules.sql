alter table public.students
  add column if not exists semester smallint check (semester between 1 and 8);

create table if not exists public.practical_experiments (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  experiment_number text not null,
  name text not null,
  instructions text not null default '',
  semester smallint check (semester between 1 and 8),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (subject, experiment_number, semester)
);

create table if not exists public.student_experiments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  experiment_id uuid not null references public.practical_experiments (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  assigned_by uuid references public.profiles (id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  report_due_at timestamptz,
  unique (student_id, experiment_id)
);

create table if not exists public.student_experiment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.student_experiments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  submission_type text not null check (submission_type in ('result', 'report')),
  file_path text not null,
  notes text not null default '',
  submitted_at timestamptz not null default now()
);

create table if not exists public.student_experiment_evaluations (
  assignment_id uuid primary key references public.student_experiments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  marks numeric(6, 2) not null check (marks >= 0),
  max_marks numeric(6, 2) not null check (max_marks > 0 and marks <= max_marks),
  remarks text not null default '',
  feedback_file_path text,
  evaluated_by uuid references public.profiles (id),
  evaluated_at timestamptz not null default now()
);
alter table public.student_experiment_evaluations
  add column if not exists feedback_file_path text;

create table if not exists public.lab_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  attendance_date date not null,
  subject text not null default '',
  status text not null check (status in ('present', 'absent', 'late')),
  remarks text,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (student_id, attendance_date, subject)
);

create table if not exists public.equipment_bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  instrument_id uuid not null references public.instruments (id),
  requested_at timestamptz not null default now(),
  needed_until timestamptz not null,
  purpose text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'issued', 'returned', 'cancelled')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  issued_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  check (needed_until > requested_at)
);

create table if not exists public.equipment_damage_reports (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  instrument_id uuid references public.instruments (id),
  booking_id uuid references public.equipment_bookings (id),
  description text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  resolution text,
  reported_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);

create table if not exists public.lab_sessions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  faculty_name text not null,
  laboratory text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  department text not null default 'ENTC',
  target_year smallint check (target_year between 1 and 8),
  target_semester smallint check (target_semester between 1 and 8),
  target_batch text,
  change_notice text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.department_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'general' check (category in ('general', 'practical_exam', 'deadline', 'maintenance', 'equipment')),
  department text not null default 'ENTC',
  target_year smallint check (target_year between 1 and 8),
  target_semester smallint check (target_semester between 1 and 8),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > published_at)
);

create index if not exists student_experiments_student_idx on public.student_experiments (student_id, assigned_at desc);
create index if not exists student_submissions_student_idx on public.student_experiment_submissions (student_id, submitted_at desc);
create index if not exists lab_attendance_student_date_idx on public.lab_attendance (student_id, attendance_date desc);
create index if not exists equipment_bookings_student_idx on public.equipment_bookings (student_id, requested_at desc);
create unique index if not exists equipment_bookings_single_active_idx
  on public.equipment_bookings (instrument_id)
  where status in ('approved', 'issued');
create index if not exists lab_sessions_starts_idx on public.lab_sessions (starts_at);
create index if not exists department_announcements_published_idx on public.department_announcements (published_at desc);

create or replace function public.has_active_equipment_booking(p_instrument_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.equipment_bookings
    where instrument_id = p_instrument_id
      and (
        status in ('approved', 'issued')
        or (status = 'pending' and needed_until > now())
      )
  );
$$;

revoke all on function public.has_active_equipment_booking(uuid) from public, anon;
grant execute on function public.has_active_equipment_booking(uuid) to authenticated;

create or replace function public.guard_instrument_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'equipment_bookings' then
    if new.status in ('approved', 'issued') then
      perform 1 from public.instruments where id = new.instrument_id for update;
      if exists (
        select 1 from public.checkout_transactions
        where instrument_id = new.instrument_id and status in ('active', 'overdue')
      ) then
        raise exception 'Equipment cannot be approved while it has an active checkout';
      end if;
    end if;
    return new;
  end if;

  if new.status in ('active', 'overdue') then
    perform 1 from public.instruments where id = new.instrument_id for update;
    if public.has_active_equipment_booking(new.instrument_id) then
      raise exception 'Equipment cannot be checked out while it has an active booking';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_equipment_booking_reservation on public.equipment_bookings;
create trigger guard_equipment_booking_reservation
  before insert or update on public.equipment_bookings
  for each row execute function public.guard_instrument_reservation();
drop trigger if exists guard_checkout_booking_reservation on public.checkout_transactions;
create trigger guard_checkout_booking_reservation
  before insert or update of instrument_id, status on public.checkout_transactions
  for each row execute function public.guard_instrument_reservation();

create or replace function public.request_student_equipment(
  p_instrument_id uuid,
  p_needed_until timestamptz,
  p_purpose text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_student_id uuid;
  selected_instrument_id uuid;
  booking_id uuid;
begin
  select id into linked_student_id
  from public.students
  where profile_id = (select auth.uid()) and is_active;
  if linked_student_id is null then
    raise exception 'Your account is not linked to an active student record';
  end if;
  if p_needed_until is null or p_needed_until <= now() or length(btrim(coalesce(p_purpose, ''))) = 0 then
    raise exception 'Provide a future return time and equipment purpose';
  end if;

  select id into selected_instrument_id
  from public.instruments
  where id = p_instrument_id and status = 'available'
  for update;
  if selected_instrument_id is null then
    raise exception 'This equipment is not currently available';
  end if;
  if exists (
    select 1 from public.equipment_bookings
    where instrument_id = p_instrument_id
      and (
        status in ('approved', 'issued')
        or (status = 'pending' and needed_until > now())
      )
  ) or exists (
    select 1 from public.checkout_transactions
    where instrument_id = p_instrument_id and status in ('active', 'overdue')
  ) then
    raise exception 'This equipment already has an active request or checkout';
  end if;

  insert into public.equipment_bookings (student_id, instrument_id, needed_until, purpose)
  values (linked_student_id, p_instrument_id, p_needed_until, btrim(p_purpose))
  returning id into booking_id;
  return booking_id;
end;
$$;

revoke all on function public.request_student_equipment(uuid, timestamptz, text) from public, anon;
grant execute on function public.request_student_equipment(uuid, timestamptz, text) to authenticated;

create or replace function public.is_lab_instructor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_lab_staff() or public.is_lab_faculty();
$$;

create or replace function public.submit_student_experiment(
  p_assignment_id uuid,
  p_submission_type text,
  p_file_path text,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_student_id uuid;
  submission_id uuid;
begin
  select id into linked_student_id
  from public.students
  where profile_id = (select auth.uid())
    and is_active;

  if linked_student_id is null then
    raise exception 'Your account is not linked to an active student record';
  end if;
  if p_submission_type not in ('result', 'report') then
    raise exception 'Submission type must be result or report';
  end if;
  if not exists (
    select 1 from public.student_experiments
    where id = p_assignment_id and student_id = linked_student_id
  ) then
    raise exception 'Experiment assignment not found for this student';
  end if;
  if p_file_path not like linked_student_id::text || '/' || p_assignment_id::text || '/' || p_submission_type || '/%' then
    raise exception 'Submission file path is invalid';
  end if;

  insert into public.student_experiment_submissions
    (assignment_id, student_id, submission_type, file_path, notes)
  values
    (p_assignment_id, linked_student_id, p_submission_type, p_file_path, coalesce(p_notes, ''))
  returning id into submission_id;

  update public.student_experiments
  set status = case when status = 'pending' then 'in_progress' else status end
  where id = p_assignment_id;

  return submission_id;
end;
$$;

revoke all on function public.submit_student_experiment(uuid, text, text, text) from public, anon;
grant execute on function public.submit_student_experiment(uuid, text, text, text) to authenticated;

create or replace function public.evaluate_student_experiment(
  p_assignment_id uuid,
  p_marks numeric,
  p_max_marks numeric,
  p_remarks text default '',
  p_feedback_file_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  linked_student_id uuid;
begin
  if not public.is_lab_instructor() then
    raise exception 'Instructor access is required to evaluate experiment work';
  end if;
  if p_max_marks <= 0 or p_marks < 0 or p_marks > p_max_marks then
    raise exception 'Marks must be between zero and the maximum marks';
  end if;

  select student_id into linked_student_id
  from public.student_experiments
  where id = p_assignment_id;
  if linked_student_id is null then
    raise exception 'Experiment assignment not found';
  end if;
  if p_feedback_file_path is not null and (
    p_feedback_file_path not like linked_student_id::text || '/' || p_assignment_id::text || '/evaluated/%'
    or lower(p_feedback_file_path) not like '%.pdf'
  ) then
    raise exception 'Evaluated report file path is invalid';
  end if;

  insert into public.student_experiment_evaluations
    (assignment_id, student_id, marks, max_marks, remarks, feedback_file_path, evaluated_by)
  values
    (p_assignment_id, linked_student_id, p_marks, p_max_marks, coalesce(p_remarks, ''), p_feedback_file_path, (select auth.uid()))
  on conflict (assignment_id) do update
    set marks = excluded.marks,
        max_marks = excluded.max_marks,
        remarks = excluded.remarks,
        feedback_file_path = coalesce(excluded.feedback_file_path, public.student_experiment_evaluations.feedback_file_path),
        evaluated_by = excluded.evaluated_by,
        evaluated_at = now();

  update public.student_experiments
  set status = 'completed'
  where id = p_assignment_id;
end;
$$;

revoke all on function public.evaluate_student_experiment(uuid, numeric, numeric, text, text) from public, anon;
grant execute on function public.evaluate_student_experiment(uuid, numeric, numeric, text, text) to authenticated;

alter table public.practical_experiments enable row level security;
alter table public.student_experiments enable row level security;
alter table public.student_experiment_submissions enable row level security;
alter table public.student_experiment_evaluations enable row level security;
alter table public.lab_attendance enable row level security;
alter table public.equipment_bookings enable row level security;
alter table public.equipment_damage_reports enable row level security;
alter table public.lab_sessions enable row level security;
alter table public.department_announcements enable row level security;

create policy "Instructors manage practical experiments" on public.practical_experiments
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));
create policy "Students read assigned experiment definitions" on public.practical_experiments
  for select to authenticated using (exists (
    select 1 from public.student_experiments
    join public.students on students.id = student_experiments.student_id
    where student_experiments.experiment_id = practical_experiments.id
      and students.profile_id = (select auth.uid())
  ));

create policy "Students read own experiment assignments" on public.student_experiments
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = student_experiments.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Instructors manage experiment assignments" on public.student_experiments
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read own experiment submissions" on public.student_experiment_submissions
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = student_experiment_submissions.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Students submit own experiment work" on public.student_experiment_submissions
  for insert to authenticated with check (
    exists (
      select 1
      from public.students
      join public.student_experiments on student_experiments.student_id = students.id
      where students.id = student_experiment_submissions.student_id
        and students.profile_id = (select auth.uid())
        and student_experiments.id = student_experiment_submissions.assignment_id
    )
    and file_path like student_id::text || '/' || assignment_id::text || '/' || submission_type || '/%'
    and (submission_type <> 'report' or lower(file_path) like '%.pdf')
  );
create policy "Instructors manage experiment submissions" on public.student_experiment_submissions
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read own experiment evaluations" on public.student_experiment_evaluations
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = student_experiment_evaluations.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Instructors manage experiment evaluations" on public.student_experiment_evaluations
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read own attendance" on public.lab_attendance
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = lab_attendance.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Instructors manage attendance" on public.lab_attendance
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read own equipment bookings" on public.equipment_bookings
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = equipment_bookings.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Instructors manage equipment bookings" on public.equipment_bookings
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read own equipment damage reports" on public.equipment_damage_reports
  for select to authenticated using (exists (
    select 1 from public.students
    where students.id = equipment_damage_reports.student_id and students.profile_id = (select auth.uid())
  ));
create policy "Students report equipment damage" on public.equipment_damage_reports
  for insert to authenticated with check (
    status = 'open' and reviewed_by is null and length(btrim(description)) > 0
    and (
      booking_id is null
      or exists (
        select 1 from public.equipment_bookings
        where equipment_bookings.id = equipment_damage_reports.booking_id
          and equipment_bookings.student_id = equipment_damage_reports.student_id
          and equipment_bookings.instrument_id = equipment_damage_reports.instrument_id
      )
    )
    and exists (
      select 1 from public.students
      where students.id = equipment_damage_reports.student_id and students.profile_id = (select auth.uid())
    )
    and (
      exists (
        select 1 from public.equipment_bookings
        where equipment_bookings.id = equipment_damage_reports.booking_id
          and equipment_bookings.student_id = equipment_damage_reports.student_id
          and equipment_bookings.instrument_id = equipment_damage_reports.instrument_id
      )
      or exists (
        select 1 from public.checkout_transactions
        where checkout_transactions.student_id = equipment_damage_reports.student_id
          and checkout_transactions.instrument_id = equipment_damage_reports.instrument_id
          and checkout_transactions.status in ('active', 'overdue')
      )
    )
  );
create policy "Instructors manage equipment damage reports" on public.equipment_damage_reports
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read matching lab sessions" on public.lab_sessions
  for select to authenticated using (exists (
    select 1 from public.students
    where students.profile_id = (select auth.uid())
      and students.department = lab_sessions.department
      and (lab_sessions.target_year is null or students.year = lab_sessions.target_year)
      and (lab_sessions.target_semester is null or students.semester = lab_sessions.target_semester)
      and (lab_sessions.target_batch is null or students.batch = lab_sessions.target_batch)
  ));
create policy "Instructors manage lab sessions" on public.lab_sessions
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students read matching announcements" on public.department_announcements
  for select to authenticated using (
    published_at <= now()
    and (expires_at is null or expires_at > now())
    and exists (
      select 1 from public.students
      where students.profile_id = (select auth.uid())
        and students.department = department_announcements.department
        and (department_announcements.target_year is null or students.year = department_announcements.target_year)
        and (department_announcements.target_semester is null or students.semester = department_announcements.target_semester)
    )
  );
create policy "Instructors manage department announcements" on public.department_announcements
  for all to authenticated using ((select public.is_lab_instructor()))
  with check ((select public.is_lab_instructor()));

create policy "Students browse available instruments" on public.instruments
  for select to authenticated using (
    status = 'available'
    and not (select public.has_active_equipment_booking(instruments.id))
    and exists (select 1 from public.students where students.profile_id = (select auth.uid()) and students.is_active)
  );
create policy "Students read their requested equipment" on public.instruments
  for select to authenticated using (
    exists (
      select 1 from public.equipment_bookings
      join public.students on students.id = equipment_bookings.student_id
      where equipment_bookings.instrument_id = instruments.id
        and students.profile_id = (select auth.uid())
    )
    or exists (
      select 1 from public.checkout_transactions
      join public.students on students.id = checkout_transactions.student_id
      where checkout_transactions.instrument_id = instruments.id
        and students.profile_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-lab-files',
  'student-lab-files',
  false,
  15728640,
  array['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students upload own lab files" on storage.objects;
create policy "Students upload own lab files" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'student-lab-files'
    and (storage.foldername(name))[1] = (
      select students.id::text from public.students
      where students.profile_id = (select auth.uid()) and students.is_active
    )
  );
drop policy if exists "Students read own lab files" on storage.objects;
create policy "Students read own lab files" on storage.objects
  for select to authenticated using (
    bucket_id = 'student-lab-files'
    and (
      (storage.foldername(name))[1] = (
        select students.id::text from public.students
        where students.profile_id = (select auth.uid())
      )
      or (select public.is_lab_instructor())
    )
  );
drop policy if exists "Instructors manage lab files" on storage.objects;
create policy "Instructors manage lab files" on storage.objects
  for all to authenticated using (
    bucket_id = 'student-lab-files' and (select public.is_lab_instructor())
  ) with check (
    bucket_id = 'student-lab-files' and (select public.is_lab_instructor())
  );

grant select, insert, update, delete on public.practical_experiments to authenticated;
grant select, insert, update, delete on public.student_experiments to authenticated;
grant select, insert, update, delete on public.student_experiment_submissions to authenticated;
grant select, insert, update, delete on public.student_experiment_evaluations to authenticated;
grant select, insert, update, delete on public.lab_attendance to authenticated;
grant select, update, delete on public.equipment_bookings to authenticated;
grant select, insert, update, delete on public.equipment_damage_reports to authenticated;
grant select, insert, update, delete on public.lab_sessions to authenticated;
grant select, insert, update, delete on public.department_announcements to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'practical_experiments', 'student_experiments', 'student_experiment_submissions',
    'student_experiment_evaluations', 'lab_attendance', 'equipment_bookings',
    'equipment_damage_reports', 'lab_sessions', 'department_announcements'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
