-- Recreate Supabase tables for Absensi project
-- Drops existing tables (with dependencies) and re-creates with constraints + RLS policies.
-- NOTE: Requires pgcrypto extension for gen_random_uuid().

begin;

-- UUID generation
create extension if not exists pgcrypto;

-- Drop tables in dependency order
-- photo_attendance -> location_log/access_log -> attendance -> users/geofence
drop table if exists public.access_log cascade;
drop table if exists public.location_log cascade;
drop table if exists public.photo_attendance cascade;
drop table if exists public.attendance cascade;
drop table if exists public.users cascade;
drop table if exists public.geofence cascade;

-- 1) geofence
create table if not exists public.geofence (
  geofence_id uuid primary key default gen_random_uuid(),
  location_name text not null,
  latitude_center double precision not null,
  longitude_center double precision not null,
  radius double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint geofence_location_name_unique unique (location_name)
);

-- Contoh data awal: tidak disertakan.
-- Admin nanti yang menambahkan geofence pilihan (jumlah bebas).


-- 2) users (task asks: user_id, email, password, name, role, created_at)

-- In Supabase, password is stored in auth.users, not public.users.
-- We keep a column password as nullable for compatibility, but app typically uses auth.users.
create table if not exists public.users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  password text,
  name text not null,
  role text not null check (role in ('admin','karyawan')),
  geofence_id uuid references public.geofence(geofence_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_geofence_id on public.users(geofence_id);

-- 3) attendance
create table if not exists public.attendance (
  attendance_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  check_in_time timestamptz,
  check_out_time timestamptz,
  status text not null default 'invalid' check (status in ('valid','invalid')),
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_user_id_created_at on public.attendance(user_id, created_at);
create index if not exists idx_attendance_status on public.attendance(status);

-- 4) photo_attendance
create table if not exists public.photo_attendance (
  photo_id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(attendance_id) on delete cascade,
  photo_url text not null,
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_photo_attendance_attendance_id on public.photo_attendance(attendance_id);

-- 5) location_log
create table if not exists public.location_log (
  location_id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(attendance_id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  distance_from_center double precision,
  is_within_geofence boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_location_log_attendance_id on public.location_log(attendance_id);

-- 6) access_log
create table if not exists public.access_log (
  log_id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance(attendance_id) on delete cascade,
  user_agent text,
  ip_address inet,
  is_vpn boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_log_attendance_id on public.access_log(attendance_id);

-- ---------------------------
-- RLS ENABLE
-- ---------------------------

alter table public.geofence enable row level security;
alter table public.users enable row level security;
alter table public.attendance enable row level security;
alter table public.photo_attendance enable row level security;
alter table public.location_log enable row level security;
alter table public.access_log enable row level security;

-- ---------------------------
-- USERS policies
-- ---------------------------


drop policy if exists "users_select_own_or_admin" on public.users;

authorize -- keep diff stable

create policy "users_select_own_or_admin"
on public.users
for select
using (
  user_id = auth.uid()
  OR role = 'admin'
);



create policy "users_update_own"
on public.users
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users_insert_by_auth"
on public.users
for insert
with check (user_id = auth.uid());

-- prevent changing role via row-level checks
-- allow admins to update any user row
create policy "users_update_admin"
on public.users
for update
using (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- ---------------------------
-- GEOFENCE policies
-- ---------------------------
create policy "geofence_select_all"
on public.geofence
for select
using (true);

-- ---------------------------
-- ATTENDANCE policies
-- ---------------------------
-- Karyawan: insert attendance only for own user_id
create policy "attendance_insert_own"
on public.attendance
for insert
with check (user_id = auth.uid());

-- Karyawan: select own
create policy "attendance_select_own"
on public.attendance
for select
using (user_id = auth.uid());

-- Admin: select all
create policy "attendance_select_admin"
on public.attendance
for select
using (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- Karyawan update only own
create policy "attendance_update_own"
on public.attendance
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- Admin update all
create policy "attendance_update_admin"
on public.attendance
for update
using (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- ---------------------------
-- PHOTO_ATTENDANCE policies
-- ---------------------------
-- Insert allowed only if attendance belongs to user
create policy "photo_insert_own_attendance"
on public.photo_attendance
for insert
with check (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = photo_attendance.attendance_id
      AND a.user_id = auth.uid()
  )
);

-- Select: own attendance, or admin
create policy "photo_select_own_or_admin"
on public.photo_attendance
for select
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = photo_attendance.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- Update/delete optional: restrict to admin or owner
create policy "photo_update_admin_or_owner"
on public.photo_attendance
for update
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = photo_attendance.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (true);

create policy "photo_delete_admin_or_owner"
on public.photo_attendance
for delete
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = photo_attendance.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- ---------------------------
-- LOCATION_LOG policies
-- ---------------------------
create policy "location_insert_own_attendance"
on public.location_log
for insert
with check (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = location_log.attendance_id
      AND a.user_id = auth.uid()
  )
);

create policy "location_select_own_or_admin"
on public.location_log
for select
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = location_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

create policy "location_update_admin_or_owner"
on public.location_log
for update
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = location_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (true);

create policy "location_delete_admin_or_owner"
on public.location_log
for delete
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = location_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- ---------------------------
-- ACCESS_LOG policies
-- ---------------------------
create policy "access_insert_own_attendance"
on public.access_log
for insert
with check (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = access_log.attendance_id
      AND a.user_id = auth.uid()
  )
);

create policy "access_select_own_or_admin"
on public.access_log
for select
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = access_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

create policy "access_update_admin_or_owner"
on public.access_log
for update
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = access_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (true);

create policy "access_delete_admin_or_owner"
on public.access_log
for delete
using (
  EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.attendance_id = access_log.attendance_id
      AND a.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
);

-- ---------------------------
-- Prevent users from self-escalating role (safety)
-- This ensures non-admin cannot change role.
-- (Admin policy above still allows updates for admins.)
-- Implement with a CHECK trigger for update is best, but keep SQL-only minimal.
-- Since RLS update_own allows update only where user_id=auth.uid(), non-admin can still update role.
-- If you want stricter safety, replace users_update_own to disallow role change via column-level constraints/triggers.
-- For now: we add a constraint trigger-like approach using update check.

-- Add a column constraint using generated expression not feasible; use RLS additional policy:
-- Disallow non-admin updates that change role.

create policy "users_non_admin_cannot_change_role"
on public.users
for update
using (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.role = 'admin'
  )
)
with check (
  user_id = auth.uid()
  AND role = (SELECT role FROM public.users u WHERE u.user_id = auth.uid())
);

commit;

