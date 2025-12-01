# Camera Heartbeat Monitoring System

## Overview
This system automatically detects cameras that haven't sent heartbeat signals and marks them as offline after 60 seconds of inactivity.

## Components

### 1. Database Schema
- Added `last_ping` column to `cameras` table
- Indexed for efficient queries

### 2. Edge Functions

#### camera-heartbeat-checker
- **Path**: `/functions/v1/camera-heartbeat-checker`
- **Purpose**: Checks all cameras for missing heartbeats
- **Threshold**: 60 seconds
- **Action**: Marks cameras as offline if no heartbeat

#### camera-ping
- **Path**: `/functions/v1/camera-ping`
- **Purpose**: Receives heartbeat from cameras
- **Body**: `{ "camera_id": "uuid" }`
- **Action**: Updates `last_ping` and sets status to online

### 3. Manual Cron Setup (Required)

The heartbeat checker needs to run automatically every 30 seconds. To set this up:

1. **Enable Extensions** (via Lovable Cloud Backend):
   - Navigate to: Backend → Database → Extensions
   - Enable `pg_cron` extension
   - Enable `pg_net` extension

2. **Create Cron Job** (via Lovable Cloud Backend):
   - Navigate to: Backend → Database → SQL Editor
   - Run this SQL:

```sql
SELECT cron.schedule(
  'camera-heartbeat-check',
  '*/30 * * * * *',
  $$
  SELECT net.http_post(
    url := 'https://xgxdeudzzbowimdufwjx.supabase.co/functions/v1/camera-heartbeat-checker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneGRldWR6emJvd2ltZHVmd2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Njc0MTcsImV4cCI6MjA3OTI0MzQxN30.jZErb2BPFp89NTtgZHV5Bp4qA826R6Y_R-i7ahIP4Gk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

3. **Verify Cron Job**:
```sql
SELECT * FROM cron.job WHERE jobname = 'camera-heartbeat-check';
```

## Testing

### Test Heartbeat Checker Manually
You can test the heartbeat checker by calling it directly:

```bash
curl -X POST https://xgxdeudzzbowimdufwjx.supabase.co/functions/v1/camera-heartbeat-checker \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneGRldWR6emJvd2ltZHVmd2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Njc0MTcsImV4cCI6MjA3OTI0MzQxN30.jZErb2BPFp89NTtgZHV5Bp4qA826R6Y_R-i7ahIP4Gk"
```

### Test Camera Ping
```bash
curl -X POST https://xgxdeudzzbowimdufwjx.supabase.co/functions/v1/camera-ping \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhneGRldWR6emJvd2ltZHVmd2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2Njc0MTcsImV4cCI6MjA3OTI0MzQxN30.jZErb2BPFp89NTtgZHV5Bp4qA826R6Y_R-i7ahIP4Gk" \
  -H "Content-Type: application/json" \
  -d '{"camera_id": "YOUR_CAMERA_ID"}'
```

## Camera Integration

Cameras should send heartbeat pings every 15-30 seconds to the camera-ping endpoint:

```javascript
// Example: Send heartbeat every 15 seconds
setInterval(async () => {
  try {
    await fetch('https://xgxdeudzzbowimdufwjx.supabase.co/functions/v1/camera-ping', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_ANON_KEY'
      },
      body: JSON.stringify({ camera_id: 'your-camera-uuid' })
    });
  } catch (error) {
    console.error('Failed to send heartbeat:', error);
  }
}, 15000);
```

## Real-time Updates

The dashboard will automatically reflect status changes via Supabase Realtime subscriptions already implemented in `useCameraRealtime` hook.

## Monitoring

Check edge function logs to monitor heartbeat checker execution:
- Backend → Edge Functions → camera-heartbeat-checker → Logs
- Backend → Edge Functions → camera-ping → Logs
