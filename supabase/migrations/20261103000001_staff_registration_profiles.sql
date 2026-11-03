alter table public.profiles
  add column if not exists phone text,
  add column if not exists subject text,
  add column if not exists is_approved boolean not null default true;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, phone, subject, is_approved)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email),
    case
      when new.raw_user_meta_data ->> 'role' = 'faculty' then 'faculty'::public.user_role
      when new.raw_user_meta_data ->> 'role' = 'lab_assistant' then 'lab_assistant'::public.user_role
      else 'student'::public.user_role
    end,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'subject', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'student') not in ('faculty', 'lab_assistant')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

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

drop policy if exists "Faculty read audit logs" on public.audit_logs;
create policy "Faculty read audit logs" on public.audit_logs
  for select to authenticated
  using ((select public.is_lab_faculty()));

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
    execute format('drop policy if exists "Faculty read %1$s" on public.%1$I', table_name);
    execute format(
      'create policy "Faculty read %1$s" on public.%1$I for select to authenticated using ((select public.is_lab_faculty()))',
      table_name
    );
  end loop;
end;
$$;
