-- Supabase migration: attendance anomaly detection fields
-- Jalankan di Supabase SQL Editor, lalu reload schema cache.

begin;

alter table public.attendance
add column if not exists anomaly_status boolean not null default false,
add column if not exists anomaly_reason text;

alter table public.access_log
add column if not exists ip_region text,
add column if not exists developer_mode_active boolean not null default false;

alter table public.access_log
alter column ip_address type text
using ip_address::text;

create index if not exists idx_attendance_anomaly_status
on public.attendance(anomaly_status);

comment on column public.attendance.anomaly_status is
'True jika absensi memiliki warning anomali yang perlu diverifikasi admin.';

comment on column public.attendance.anomaly_reason is
'Alasan anomali, misalnya Developer Mode Active atau IP Address Outside Operational Area.';

comment on column public.access_log.ip_region is
'Region/provinsi hasil lookup IP saat absensi dilakukan.';

comment on column public.access_log.developer_mode_active is
'Status developer mode perangkat yang dikirim/dideteksi saat absensi.';

notify pgrst, 'reload schema';

commit;
