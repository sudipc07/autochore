-- Add GPS to recorded sessions.
-- The CHARM band logs GPS (NMEA, ~every 30 s) alongside the 50 Hz IMU. Store
-- parsed fixes here, mirroring altitude_samples (jsonb array, default empty).
alter table public.sessions
  add column if not exists gps_samples jsonb not null default '[]'::jsonb;

-- Each element (send what the receiver has — lat/lon are the core):
--   {
--     "t":      <ms since session start>,
--     "lat":    <decimal degrees, S negative>,
--     "lon":    <decimal degrees, W negative>,
--     "alt":    <metres, optional>,
--     "speed":  <m/s, optional>,
--     "course": <degrees, optional>,
--     "fix":    "A"        -- NMEA status / fix quality, optional
--   }
-- Convert NMEA ddmm.mmmm -> dd.dddddd before storing (don't store raw sentences).
