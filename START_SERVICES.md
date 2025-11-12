# How to Start/Restart Services

## Issue
- Backend `/roar` endpoint returns 404 (needs restart to load new route)
- Frontend `/roar` page not accessible (frontend not running)

## Quick Fix

### Option 1: Using PM2 (Recommended)
```bash
cd /opt/looqta

# Restart both services
pm2 restart looqta-backend looqta-frontend

# Or if not running, start them
pm2 start ecosystem.config.js

# Check status
pm2 list
pm2 logs
```

### Option 2: Manual Restart

**Backend:**
```bash
# Stop existing backend
pkill -f "node.*src/index.js"

# Start backend
cd /opt/looqta/backend
npm start
```

**Frontend:**
```bash
# Stop existing frontend
pkill -f "next.*start"

# Build frontend (if needed)
cd /opt/looqta/frontend
npm run build

# Start frontend
npm start
```

### Option 3: Use Restart Script
```bash
cd /opt/looqta
./restart-services.sh
```

## Validate After Restart

```bash
# Run validation script
node /opt/looqta/validate-roar-fix.js

# Or test manually
curl http://localhost:4000/roar
curl http://localhost:3000/roar
```

## What Was Fixed

1. ✅ Added GET `/roar` endpoint in backend (returns health check JSON)
2. ✅ Removed unused `useRouter` import from frontend `roar.js`
3. ✅ Created validation script to test endpoints

The backend just needs a restart to pick up the new route!
