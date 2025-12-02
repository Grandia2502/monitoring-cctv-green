# Recording Feature Documentation

## Overview
This document describes the CCTV recording feature implementation for the Web Monitoring CCTV application. The current implementation provides a complete UI/UX foundation with database structure and edge functions ready for backend video processing integration.

## Architecture

### Current Implementation (MVP/Prototype)
The recording feature is built with:
- **Frontend**: React components with real-time recording state management
- **Database**: Supabase `recordings` table with comprehensive metadata
- **Edge Functions**: State management for start/stop recording operations
- **Real-time Updates**: Automatic UI refresh when recordings change

### What Works Now
✅ Complete recording UI with timer and status indicators
✅ Start/Stop recording buttons on each camera card
✅ Real-time recording duration display (HH:MM:SS format)
✅ Camera status management (online → recording → online)
✅ Recording metadata stored in database
✅ Real-time updates across all pages
✅ Offline camera detection (recording disabled)
✅ Visual feedback with animations and toasts
✅ Monitoring Records page displays all recordings

### What Needs External Backend
❌ Actual video capture from MJPEG stream (requires ffmpeg)
❌ Video file upload to Supabase Storage
❌ Thumbnail generation from video
❌ Accurate file size calculation

## Database Schema

### Table: `recordings`
```sql
CREATE TABLE public.recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  file_url TEXT,                    -- URL to video file in storage
  thumbnail_url TEXT,                -- URL to thumbnail image
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration INTEGER,                  -- Duration in seconds
  size_mb FLOAT,                     -- File size in megabytes
  status TEXT NOT NULL DEFAULT 'recording', -- recording, completed, failed
  error_message TEXT,                -- Error details if failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Recording Status Flow
1. **recording**: Active recording in progress
2. **completed**: Recording stopped, video uploaded successfully
3. **failed**: Recording encountered an error

## Edge Functions

### 1. `start-recording`
**Endpoint**: `/functions/v1/start-recording`

**Request**:
```json
{
  "camera_id": "uuid",
  "stream_url": "http://camera-ip:port/stream"
}
```

**Response**:
```json
{
  "recording_id": "uuid",
  "camera_id": "uuid",
  "started_at": "2024-01-01T10:00:00Z",
  "status": "recording",
  "message": "Recording started successfully..."
}
```

**Operations**:
- Validates camera exists and is online
- Creates recording record in database
- Updates camera status to "recording"
- Returns recording_id for tracking

### 2. `stop-recording`
**Endpoint**: `/functions/v1/stop-recording`

**Request**:
```json
{
  "recording_id": "uuid"
}
```

**Response**:
```json
{
  "recording_id": "uuid",
  "duration": 120,
  "ended_at": "2024-01-01T10:02:00Z",
  "status": "completed",
  "message": "Recording stopped successfully..."
}
```

**Operations**:
- Validates recording exists and is active
- Calculates recording duration
- Updates recording with end time
- Updates camera status back to "online"
- Sets placeholder file_url (backend should update this)

## Frontend Components

### `useRecording` Hook
Custom React hook for managing recording state per camera.

**Location**: `src/hooks/useRecording.ts`

**Features**:
- Start/stop recording functions
- Real-time duration timer
- Formatted duration display (HH:MM:SS)
- Error handling with toast notifications
- Automatic cleanup on unmount

**Usage**:
```typescript
const { 
  isRecording, 
  formattedDuration, 
  startRecording, 
  stopRecording 
} = useRecording(cameraId, cameraStatus);
```

### Updated `CameraCard` Component
Enhanced camera card with recording capabilities.

**New Features**:
- Recording timer overlay (top-right corner)
- Disabled recording for offline cameras
- Visual feedback: pulsing red dot during recording
- Grayscale effect for offline cameras
- Video preview placeholder
- Dynamic button states (Start Recording / Stop Recording)

### `MonitoringRecords` Page
Displays all recordings with real-time updates.

**Features**:
- Automatic refresh when new recordings added
- Real-time subscription to recordings table
- Filter by camera, priority, date range
- View, download, delete actions (UI ready)

## Integration Guide for Backend Video Processing

To complete the recording feature with actual video capture, you'll need an external backend service with ffmpeg. Here's how to integrate:

### Step 1: Setup Backend Service (VPS/Server)
Install required dependencies:
```bash
# Ubuntu/Debian
apt-get update
apt-get install -y ffmpeg

# Install Node.js/Python for backend service
```

### Step 2: Backend Recording Service
Create a service that:
1. Listens for webhook from `start-recording` edge function
2. Uses ffmpeg to capture MJPEG stream
3. Saves video file temporarily
4. Uploads to Supabase Storage when recording stops
5. Updates recording metadata via webhook to `stop-recording`

**Example ffmpeg command**:
```bash
ffmpeg -i http://camera-ip:port/stream \
  -t {duration_seconds} \
  -c:v libx264 \
  -preset ultrafast \
  -f mp4 \
  /tmp/recording_{recording_id}.mp4
```

### Step 3: Supabase Storage Upload
After recording completes:
```javascript
const { data, error } = await supabase.storage
  .from('recordings')
  .upload(`${camera_id}/${recording_id}.mp4`, videoFile);

// Update recording with file URL
await supabase
  .from('recordings')
  .update({
    file_url: data.path,
    size_mb: fileSizeInMB,
    status: 'completed'
  })
  .eq('id', recording_id);
```

### Step 4: Thumbnail Generation
Generate thumbnail using ffmpeg:
```bash
ffmpeg -i video.mp4 \
  -ss 00:00:01 \
  -vframes 1 \
  thumbnail.jpg
```

Upload to storage and update `thumbnail_url`.

## Alternative: Browser-based Recording (Simplified)
If you want to avoid external backend:

1. Use MediaRecorder API in browser
2. Capture stream directly from MJPEG source
3. Upload recorded chunks to Supabase Storage
4. Limited to streams accessible from user's browser

**Pros**: No external backend needed
**Cons**: Browser limitations, network overhead, not scalable

## Testing

### Current Testing Capabilities
1. Click "Start Recording" on any online camera
2. Observe timer counting up
3. Camera status changes to "recording"
4. Click "Stop Recording"
5. Recording appears in Monitoring Records page
6. Real-time updates work across Dashboard and Monitoring Records

### What's Not Captured Yet
- No actual video file (placeholder URL used)
- No thumbnail generated
- File size shows as null
- Video playback will fail (no real file)

## Next Steps

### For Production Deployment
1. **Setup Backend Service**: Deploy video processing server with ffmpeg
2. **Configure Webhooks**: Connect edge functions to backend service
3. **Storage Configuration**: Ensure Supabase Storage bucket "recordings" is properly configured
4. **Update Edge Functions**: Add webhook calls to backend service
5. **Test End-to-End**: Verify complete recording workflow
6. **Add Error Handling**: Implement retry logic, timeout handling
7. **Monitoring**: Setup logging for backend recording service

### Optional Enhancements
- Schedule automatic recordings
- Motion detection triggers
- Email notifications when recording completes
- Multi-camera simultaneous recording
- Recording quality presets (low/medium/high)
- Automatic old recording cleanup

## Security Considerations

### Current Implementation
✅ RLS policies on recordings table (authenticated users only)
✅ Edge function authentication required
✅ Camera ownership validation

### Backend Service Security
⚠️ Implement API authentication between edge functions and backend
⚠️ Validate webhook signatures
⚠️ Rate limiting on recording requests
⚠️ Storage access controls

## Cost Estimation

### Current Costs (Prototype)
- Database operations: Minimal (metadata only)
- Edge function invocations: ~2 calls per recording
- Storage: None yet (no video files)

### Production Costs (with Video)
- Storage: ~50-100 MB per 10-minute recording
- Bandwidth: Download from camera + upload to storage
- Backend server: VPS/server hosting costs
- Supabase storage costs based on volume

## Support & Documentation

For questions or issues:
1. Check edge function logs: `supabase functions logs`
2. Review recordings table: Check status and error_message columns
3. Test with single camera first before multi-camera setup
4. Monitor backend service logs for ffmpeg errors

## File Locations

### Frontend
- `src/hooks/useRecording.ts` - Recording state management hook
- `src/components/CameraCard.tsx` - Camera card with recording UI
- `src/pages/MonitoringRecords.tsx` - Recordings display page

### Backend
- `supabase/functions/start-recording/index.ts` - Start recording edge function
- `supabase/functions/stop-recording/index.ts` - Stop recording edge function

### Database
- Table: `public.recordings`
- Realtime enabled for live updates
- RLS policies for security

---

**Last Updated**: 2024
**Status**: MVP/Prototype Ready for Backend Integration
