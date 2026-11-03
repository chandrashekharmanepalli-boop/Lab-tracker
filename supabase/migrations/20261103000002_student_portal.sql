alter table public.students
  add column if not exists profile_id uuid unique references public.profiles (id) on delete set null;

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

drop trigger if exists guard_student_profile_link on public.students;
create trigger guard_student_profile_link
  before insert or update on public.students
  for each row execute function public.guard_student_profile_link();

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

drop policy if exists "Students read their linked record" on public.students;
create policy "Students read their linked record" on public.students
  for select to authenticated
  using (profile_id = (select auth.uid()));

drop policy if exists "Students read their checkouts" on public.checkout_transactions;
create policy "Students read their checkouts" on public.checkout_transactions
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = checkout_transactions.student_id
      and students.profile_id = (select auth.uid())
  ));

drop policy if exists "Students read instruments they checked out" on public.instruments;
create policy "Students read instruments they checked out" on public.instruments
  for select to authenticated
  using (exists (
    select 1
    from public.checkout_transactions
    join public.students on students.id = checkout_transactions.student_id
    where checkout_transactions.instrument_id = instruments.id
      and students.profile_id = (select auth.uid())
  ));

drop policy if exists "Students read their gate events" on public.gate_events;
create policy "Students read their gate events" on public.gate_events
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = gate_events.student_id
      and students.profile_id = (select auth.uid())
  ));

drop policy if exists "Students read their alerts" on public.unauthorized_alerts;
create policy "Students read their alerts" on public.unauthorized_alerts
  for select to authenticated
  using (exists (
    select 1 from public.students
    where students.id = unauthorized_alerts.student_id
      and students.profile_id = (select auth.uid())
  ));
