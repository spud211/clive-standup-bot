# Clive: Standup AI — PowerShell Reference

All examples use `localhost:3002`. Change the base URL if running on a remote server.

## Quick Start

```powershell
# 1. Start Clive in API mode
#    npm run api

# 2. Join a meeting
$session = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/sessions" `
  -ContentType "application/json" `
  -Body '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"}'
$session

# 3. Check status
Invoke-RestMethod -Uri "http://localhost:3002/sessions/$($session.id)"

# 4. Leave the meeting
Invoke-RestMethod -Method Delete -Uri "http://localhost:3002/sessions/$($session.id)"
```

## Endpoints

### Health Check

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/health"
```

### Join a Meeting

```powershell
# Minimal — uses default bot name and last speaker from env
Invoke-RestMethod -Method Post -Uri "http://localhost:3002/sessions" `
  -ContentType "application/json" `
  -Body '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"}'
```

```powershell
# With custom bot name and last speaker
$body = @{
  meetingUrl   = "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"
  botName      = "Standup Bot"
  lastSpeaker  = "Smith"
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://localhost:3002/sessions" `
  -ContentType "application/json" `
  -Body $body
```

### List All Sessions

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/sessions"
```

### Get Session Status

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/sessions/SESSION_ID_HERE"
```

### Leave a Meeting

```powershell
Invoke-RestMethod -Method Delete -Uri "http://localhost:3002/sessions/SESSION_ID_HERE"
```

## Joining Multiple Meetings

```powershell
# Join two meetings at once
$meeting1 = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/sessions" `
  -ContentType "application/json" `
  -Body '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/MEETING_1_URL"}'

$meeting2 = Invoke-RestMethod -Method Post -Uri "http://localhost:3002/sessions" `
  -ContentType "application/json" `
  -Body '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/MEETING_2_URL"}'

# Check all sessions
Invoke-RestMethod -Uri "http://localhost:3002/sessions"

# Leave both
Invoke-RestMethod -Method Delete -Uri "http://localhost:3002/sessions/$($meeting1.id)"
Invoke-RestMethod -Method Delete -Uri "http://localhost:3002/sessions/$($meeting2.id)"
```
