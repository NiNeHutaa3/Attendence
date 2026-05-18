-- Jalankan di Supabase SQL Editor untuk mengecek penyebab error schema cache
-- "could not find the event_type column of photo_attendance in the schema cache".

-- 1) Cek apakah kolom event_type sudah ada di tabel yang dipakai frontend.
select
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('photo_attendance', 'location_log', 'access_log')
  and column_name = 'event_type'
order by table_name;

-- Hasil yang benar harus menampilkan 3 baris:
-- public.access_log.event_type
-- public.location_log.event_type
-- public.photo_attendance.event_type

-- 2) Cek struktur lengkap tabel evidence absensi.
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('photo_attendance', 'location_log', 'access_log')
order by table_name, ordinal_position;

-- 3) Cek constraint enum-like untuk event_type.
select
  conrelid::regclass as table_name,
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
from pg_constraint
where conrelid in (
  'public.photo_attendance'::regclass,
  'public.location_log'::regclass,
  'public.access_log'::regclass
)
  and pg_get_constraintdef(oid) ilike '%event_type%'
order by table_name::text, constraint_name;

-- 4) Jika query nomor 1 belum menampilkan 3 baris, jalankan migration ini.
alter table public.photo_attendance
add column if not exists event_type text
not null
default 'checkin'
check (event_type in ('checkin', 'checkout'));

alter table public.location_log
add column if not exists event_type text
not null
default 'checkin'
check (event_type in ('checkin', 'checkout'));

alter table public.access_log
add column if not exists event_type text
not null
default 'checkin'
check (event_type in ('checkin', 'checkout'));

create index if not exists idx_photo_attendance_event_type
on public.photo_attendance(event_type);

create index if not exists idx_location_log_event_type
on public.location_log(event_type);

create index if not exists idx_access_log_event_type
on public.access_log(event_type);

-- 5) Paksa PostgREST/Supabase reload schema cache.
notify pgrst, 'reload schema';

-- 6) Jalankan ulang cek ini setelah migration + reload cache.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('photo_attendance', 'location_log', 'access_log')
  and column_name = 'event_type'
order by table_name;

-- 7) Cek kolom attendance yang dipakai proses check-out.
-- Kode frontend mengupdate check_out_time dan updated_at.
select
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'attendance'
  and column_name in ('check_out_time', 'updated_at')
order by column_name;

-- Jika updated_at belum ada, jalankan ini.
alter table public.attendance
add column if not exists updated_at timestamptz not null default now();

-- Reload schema cache setelah perubahan kolom.
notify pgrst, 'reload schema';

-- 8) Opsional: jika check-out evidence sudah masuk tetapi attendance.check_out_time masih null,
-- backfill check_out_time dari checkout evidence terbaru.
update public.attendance a
set
  check_out_time = evidence.last_checkout_at,
  updated_at = evidence.last_checkout_at
from (
  select
    attendance_id,
    max(created_at) as last_checkout_at
  from public.photo_attendance
  where event_type = 'checkout'
  group by attendance_id
) evidence
where a.attendance_id = evidence.attendance_id
  and a.check_out_time is null;
