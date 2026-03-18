# Clive: Standup AI — macOS / curl Reference

All examples use `localhost:3002`. Change the base URL if running on a remote server.

## Quick Start

```bash
# 1. Start Clive in API mode
#    npm run api

# 2. Join a meeting
SESSION=$(curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"}')
echo "$SESSION"

# 3. Get the session ID
SESSION_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# 4. Check status
curl -s http://localhost:3002/sessions/$SESSION_ID | python3 -m json.tool

# 5. Leave the meeting
curl -s -X DELETE http://localhost:3002/sessions/$SESSION_ID | python3 -m json.tool
```

## Endpoints

### Health Check

```bash
curl -s http://localhost:3002/health | python3 -m json.tool
```

### Join a Meeting

```bash
# Minimal — uses default bot name and last speaker from env
curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL"}' \
  | python3 -m json.tool
```

```bash
# With custom bot name and last speaker
curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "meetingUrl": "https://teams.microsoft.com/l/meetup-join/YOUR_MEETING_URL",
    "botName": "Standup Bot",
    "lastSpeaker": "Smith"
  }' | python3 -m json.tool
```

### List All Sessions

```bash
curl -s http://localhost:3002/sessions | python3 -m json.tool
```

### Get Session Status

```bash
curl -s http://localhost:3002/sessions/SESSION_ID_HERE | python3 -m json.tool
```

### Leave a Meeting

```bash
curl -s -X DELETE http://localhost:3002/sessions/SESSION_ID_HERE | python3 -m json.tool
```

## Joining Multiple Meetings

```bash
# Join two meetings at once
MEETING1=$(curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/MEETING_1_URL"}')
M1_ID=$(echo "$MEETING1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

MEETING2=$(curl -s -X POST http://localhost:3002/sessions \
  -H "Content-Type: application/json" \
  -d '{"meetingUrl": "https://teams.microsoft.com/l/meetup-join/MEETING_2_URL"}')
M2_ID=$(echo "$MEETING2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# Check all sessions
curl -s http://localhost:3002/sessions | python3 -m json.tool

# Leave both
curl -s -X DELETE http://localhost:3002/sessions/$M1_ID | python3 -m json.tool
curl -s -X DELETE http://localhost:3002/sessions/$M2_ID | python3 -m json.tool
```

## Tips

- Pipe any command through `python3 -m json.tool` for pretty-printed output
- If you have `jq` installed, use that instead for cleaner JSON parsing:
  ```bash
  # Extract session ID with jq
  SESSION_ID=$(curl -s -X POST http://localhost:3002/sessions \
    -H "Content-Type: application/json" \
    -d '{"meetingUrl": "..."}' | jq -r '.id')
  ```
