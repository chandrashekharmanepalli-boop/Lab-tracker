alter table public.profiles
  add column if not exists student_roll_no text,
  add column if not exists department text,
  add column if not exists academic_year smallint,
  add column if not exists semester smallint,
  add column if not exists batch text;

alter table public.students
  add column if not exists semester smallint check (semester between 1 and 8);

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
  selected_phone := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'phone'), ''),
    new.phone
  );

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
