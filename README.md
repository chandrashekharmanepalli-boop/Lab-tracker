# BIT Lab Tracker

Real-time laboratory inventory and instrument tracking app built with React,
TypeScript, Vite, and Supabase.

## Create and configure Supabase

1. Create a Supabase account and a new project from the
   [Supabase Dashboard](https://supabase.com/dashboard). Save the database
   password in your password manager.
2. In **Project Settings → API**, copy the project URL and the public
   anon/publishable key. Never use a `service_role` or secret key in this app.
3. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](./supabase/schema.sql),
   and run it once. It creates the database tables, role-based row security,
   profile creation for new accounts, and enables database change events for
   Supabase Realtime.
4. Run every file in [`supabase/migrations`](./supabase/migrations) in filename
   order, executing each file separately after the base schema. This applies to
   both new and existing projects. The student portal migrations create the
   experiment, attendance, booking, report, timetable, announcement, and
   evaluation records, adds the private `student-lab-files` Storage bucket, and
   installs the RLS policies and submission/evaluation RPCs. The latest
   registration migration stores student academic details in the profile and
   creates an unlinked student directory record for administrator verification.
   Do not skip these migrations.
5. Create your first administrator account in **Authentication → Users**. In the SQL Editor,
   give that account the initial administrator role, replacing the email:

   ```sql
   update public.profiles
   set role = 'admin'
   where email = 'you@example.com';
   ```

   Users can sign in or register with email or mobile number. Phone accounts
   require phone authentication and an SMS provider to be enabled in Supabase;
   the verification code is entered on the registration page. Ten-digit Indian
   mobile numbers are normalized to the +91 country code. Faculty and lab-assistant
   registrations include contact details and stay pending until an administrator
   approves them in **Settings → Users & Roles**. Configure Supabase email
   confirmation according to your institution's requirements.

   Administrators and faculty have role-specific dashboards and a live **Lab
   Activity** page for checkouts, component stock, alerts, and inventory history.
   Faculty accounts can view lab data but cannot make administrative changes.
   Administrators configure the weekly opening hours in **Settings → General**;
   the schedule appears on both dashboards.

   Student registration asks for the roll number, department, academic year,
   semester, and batch. Their details are saved to Supabase, and an unlinked
   directory entry is created for administrator verification before access is
   linked. Students then see a private academic portal with assigned experiments, PDF report
   submissions, faculty evaluations, official attendance, equipment requests
   and damage reports, timetable, announcements, and their verified profile.
   An administrator must link a student login to its verified directory record
   in **Settings → Users & Roles** and set the student's semester in
   **Students** so semester-specific sessions/notices can be targeted. RFID
   gate events are shown only as lab activity and are never treated as official
   attendance. Faculty, lab assistants, and administrators can manage these
   records from **Academic Management**.

6. Copy `.env.example` to `.env` and set the project URL and public anon key:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
   ```

   `.env` is ignored by Git. Never commit credentials or put a service-role key
   in a `VITE_` variable. Sign-in is kept only for the current page session;
   reopening or refreshing the site requires signing in again.
7. Install dependencies and start the app:

   ```sh
   npm install
   npm run dev
   ```

   Restart Vite after changing `.env`.

## Build and lint

```sh
npm run build
npm run lint
```

## Hardware

The database and web app can display live device events after a device writes
them to Supabase. Physical RFID, gate, and weighing hardware still needs device
firmware and a secured server-side ingestion endpoint; the browser must never
receive a service-role key. The hardware endpoint descriptions in the UI are
not deployed APIs.
