# Web Absensi - Attendance System with Geolocation

A modern, feature-rich attendance tracking application built with Next.js, React, and Tailwind CSS. The system uses geolocation technology to track employee attendance and integrates with Supabase for authentication and database management.

## 🎯 Features

### Core Features
- **Authentication**: Email/password-based login and registration via Supabase
- **Role-Based Access Control**: Separate dashboards for Admin and Karyawan (Employee)
- **Geolocation Check-in/Check-out**: GPS-based attendance tracking with radius validation
- **Real-time Camera Capture**: Photo attachment for attendance records
- **Distance Calculation**: Uses Turf.js Haversine algorithm for accurate geofence validation
- **Map Visualization**: Leaflet.js integration for location display

### Admin Features
- Dashboard with attendance statistics
- User management (CRUD operations)
- Attendance history and filtering
- Per-user and per-date attendance reports
- Attendance detail viewing with location and photo

### Employee Features
- Check-in/Check-out with photo capture
- Real-time location map
- Distance to office calculation
- Attendance status indicator
- Daily attendance summary

### Security & Logging
- IP address logging
- User-agent tracking
- VPN detection placeholder
- Access logs for audit trail

## 🛠️ Tech Stack

- **Frontend**: React 19 + Next.js 16 (App Router)
- **Styling**: Tailwind CSS 4
- **Maps**: Leaflet.js + OpenStreetMap
- **Geolocation**: Turf.js (Haversine algorithm)
- **Backend & Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage (Photos)
- **Type Safety**: TypeScript

## 📋 Prerequisites

- Node.js 18+ and npm/yarn
- Supabase account
- Browser with Geolocation support
- Camera device (for photo capture)

## 🚀 Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

Create a new Supabase project at https://supabase.com

Create an `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NEXT_PUBLIC_GEOFENCE_LAT=-6.2088
NEXT_PUBLIC_GEOFENCE_LNG=106.8456
NEXT_PUBLIC_GEOFENCE_RADIUS=100
```

### 3. Set Up Database Tables

Run the following SQL in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'karyawan')) DEFAULT 'karyawan',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Attendance table
CREATE TABLE attendance (
  attendance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  check_in_time TIMESTAMP DEFAULT NOW(),
  check_out_time TIMESTAMP,
  status TEXT CHECK (status IN ('valid', 'invalid')) DEFAULT 'valid',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Photo Attendance table
CREATE TABLE photo_attendance (
  photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(attendance_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  captured_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Location Log table
CREATE TABLE location_log (
  location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(attendance_id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  distance_from_center DECIMAL(10, 2) NOT NULL,
  is_within_geofence BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Access Log table
CREATE TABLE access_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(attendance_id) ON DELETE CASCADE,
  user_agent TEXT,
  ip_address TEXT,
  is_vpn BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Geofence table
CREATE TABLE geofence (
  geofence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_name TEXT NOT NULL,
  latitude_center DECIMAL(10, 8) NOT NULL,
  longitude_center DECIMAL(11, 8) NOT NULL,
  radius DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_created_at ON attendance(created_at);
CREATE INDEX idx_photo_attendance_id ON photo_attendance(attendance_id);
CREATE INDEX idx_location_log_id ON location_log(attendance_id);
CREATE INDEX idx_access_log_id ON access_log(attendance_id);
```

### 3.1 Employee Geofence Assignment

Run this migration if you want admins to assign each employee to a specific location and radius.
This creates 3 nearby locations, each with 50m and 100m geofence options.

```sql
alter table public.users
add column if not exists geofence_id uuid references public.geofence(geofence_id);

create index if not exists idx_users_geofence_id on public.users(geofence_id);

insert into public.geofence (location_name, latitude_center, longitude_center, radius)
values
  ('Kantor Utama', -6.20880000, 106.84560000, 50),
  ('Kantor Utama', -6.20880000, 106.84560000, 100),
  ('Kantor Barat', -6.20930000, 106.84180000, 50),
  ('Kantor Barat', -6.20930000, 106.84180000, 100),
  ('Kantor Timur', -6.20790000, 106.84940000, 50),
  ('Kantor Timur', -6.20790000, 106.84940000, 100)
on conflict do nothing;

alter table public.geofence enable row level security;

drop policy if exists "Authenticated users can read geofence" on public.geofence;
drop policy if exists "Admins can manage geofence" on public.geofence;

create policy "Authenticated users can read geofence"
on public.geofence
for select
to authenticated
using (true);

create policy "Admins can manage geofence"
on public.geofence
for all
to authenticated
using (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
with check (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin');
```

### 3.2 Check-out Evidence

Run this migration so check-in and check-out photos, location logs, and access logs can be
distinguished in Supabase.

```sql
alter table public.photo_attendance
add column if not exists event_type text
check (event_type in ('checkin', 'checkout'))
default 'checkin';

alter table public.location_log
add column if not exists event_type text
check (event_type in ('checkin', 'checkout'))
default 'checkin';

alter table public.access_log
add column if not exists event_type text
check (event_type in ('checkin', 'checkout'))
default 'checkin';

create index if not exists idx_photo_attendance_event_type
on public.photo_attendance(event_type);

create index if not exists idx_location_log_event_type
on public.location_log(event_type);

create index if not exists idx_access_log_event_type
on public.access_log(event_type);
```

### 4. Create Storage Bucket

In Supabase Storage, create a bucket named `attendance-photo` with the following settings:
- Make it public
- Set appropriate file size limits

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📱 Usage

### For Employees

1. **Register/Login**: Create an account or login with your credentials
2. **Check-in**:
   - Click "Get Location" to get your current GPS position
   - System validates if you're within the geofence (100m radius)
   - Open camera and capture a photo
   - Submit to check-in
3. **Check-out**: After check-in, click "Check Out" when leaving

### For Admins

1. **Dashboard**: View overall attendance statistics
2. **Users**: Add, edit, or delete employee accounts
3. **Attendance**: Filter and view attendance records by date and employee

## 🗺️ Geolocation Logic

The app uses Turf.js's `distance` function to calculate the straight-line distance between:
- **User Location**: GPS coordinates from device
- **Office Location**: Pre-configured center point (latitude/longitude)

Formula used: Haversine distance calculation
- Returns distance in meters
- Compares against `GEOFENCE_RADIUS` (default: 100m)
- Marks attendance as "valid" if within radius, "invalid" otherwise

## 🎨 UI/UX

- **Theme**: Dark navy (navy-950) with blue accents
- **Design Pattern**: Card-based layout with soft shadows
- **Components**: Modular, reusable components
- **Responsiveness**: Fully responsive (mobile + desktop)
- **Loading States**: Skeleton loaders for better UX

## 📦 Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── dashboard/    # Dashboard pages (admin, karyawan)
│   ├── login/        # Login page
│   ├── register/     # Registration page
│   ├── layout.tsx    # Root layout
│   └── page.tsx      # Home page (redirects to dashboard)
├── components/
│   ├── auth/         # Authentication components
│   ├── common/       # Shared components
│   └── dashboard/    # Dashboard-specific components
├── hooks/            # Custom React hooks
├── lib/              # Library functions (Supabase client)
├── types/            # TypeScript type definitions
└── utils/            # Utility functions (geolocation, camera)
```

## 🔐 Security Notes

- Passwords are hashed and stored via Supabase Auth
- All API calls use Supabase JWT tokens
- Photo access through Supabase authenticated storage
- Environment variables are never exposed on client
- Row-level security (RLS) should be configured in Supabase

## 🚢 Deployment

### Vercel (Recommended)

```bash
npm run build
vercel
```

### Other Platforms

```bash
npm run build
npm run start
```

## 📝 Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | https://xxx.supabase.co |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase anonymous key | eyJxxx... |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key for admin-only user creation. Keep server-side only. | eyJxxx... |
| NEXT_PUBLIC_GEOFENCE_LAT | Office latitude | -6.2088 |
| NEXT_PUBLIC_GEOFENCE_LNG | Office longitude | 106.8456 |
| NEXT_PUBLIC_GEOFENCE_RADIUS | Geofence radius in meters | 100 |

## 🐛 Troubleshooting

### Supabase email rate limit exceeded
- Supabase's built-in email service is meant for testing and has a low hourly email limit.
- For local development, go to Supabase Dashboard > Authentication > Providers > Email and disable **Confirm email**, then try registering again.
- For production, configure a custom SMTP provider, then adjust Authentication > Rate Limits if needed.
- If you keep email confirmation enabled, wait until the email limit resets before trying more signups.

### Camera not working
- Check browser permissions
- Ensure HTTPS (except localhost)
- Try different browser

### Geolocation not working
- Check browser GPS permissions
- Need HTTPS in production
- Wait for GPS to lock (may take a few seconds)

### Supabase connection issues
- Verify environment variables
- Check Supabase project is active
- Test connection in Supabase dashboard

## 🎓 Future Enhancements

- [ ] Real VPN detection via API
- [ ] Multi-office support
- [ ] Attendance reports (CSV/PDF export)
- [ ] Real-time notifications
- [ ] Mobile app (React Native)
- [ ] QR code check-in
- [ ] Face recognition
- [ ] Punch time rules/policies

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 👨‍💻 Support

For issues or questions, please create an issue in the repository.

---

**Happy Tracking! 🎯**
