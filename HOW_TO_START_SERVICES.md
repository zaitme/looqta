# How to Start Looqta Services

## ⚠️ Important
**You cannot run `npm start` from the root directory** (`/opt/looqta`). 
The root `package.json` doesn't have a `start` script.

## 🚀 Quick Start (Recommended)

### Option 1: Use PM2 (Best for Production)
```bash
cd /opt/looqta
pm2 start ecosystem.config.js
```

This will start both backend and frontend automatically.

**Useful PM2 commands:**
```bash
pm2 list              # View running services
pm2 logs              # View logs
pm2 restart all       # Restart all services
pm2 stop all          # Stop all services
pm2 restart looqta-backend   # Restart just backend
pm2 restart looqta-frontend  # Restart just frontend
pm2 monit             # Monitor services
```

### Option 2: Use Start Script
```bash
cd /opt/looqta
./start-all.sh
```

This script will:
- Use PM2 if available, or
- Start services manually if PM2 is not installed

### Option 3: Manual Start

**Start Backend:**
```bash
cd /opt/looqta/backend
npm start
# Backend runs on http://localhost:4000
```

**Start Frontend (in a new terminal):**
```bash
cd /opt/looqta/frontend
npm run build    # Build first (required for production)
npm start
# Frontend runs on http://localhost:3000
```

## 🔍 Verify Services Are Running

### Check Backend:
```bash
curl http://localhost:4000/api/health
# Should return: {"ok":true,"ts":"..."}
```

### Check Frontend:
```bash
curl http://localhost:3000/
# Should return HTML
```

### Validate ROAR Endpoints:
```bash
node /opt/looqta/validate-and-fix-roar.js
```

## 📋 Service Ports

- **Backend**: Port 4000 (`http://localhost:4000`)
- **Frontend**: Port 3000 (`http://localhost:3000`)

## 🐛 Troubleshooting

### Backend not starting?
1. Check if port 4000 is already in use:
   ```bash
   lsof -i :4000
   ```
2. Check backend logs:
   ```bash
   tail -f /opt/looqta/backend/logs/error.log
   ```

### Frontend not starting?
1. Check if port 3000 is already in use:
   ```bash
   lsof -i :3000
   ```
2. Make sure you've built the frontend:
   ```bash
   cd /opt/looqta/frontend
   npm run build
   ```

### ROAR still giving 404?
1. Make sure backend is restarted after code changes:
   ```bash
   pm2 restart looqta-backend
   # OR
   cd /opt/looqta/backend && pkill -f "node.*src/index.js" && npm start
   ```

## 📝 Summary

**Root directory (`/opt/looqta`)**: No start script - use PM2 or start scripts
**Backend directory (`/opt/looqta/backend`)**: Has `npm start` script
**Frontend directory (`/opt/looqta/frontend`)**: Has `npm start` script (requires build first)

**Best Practice**: Use PM2 with `ecosystem.config.js` for production deployments.
