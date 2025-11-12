#!/bin/bash
# Script to restart backend and frontend services

echo "🔄 Restarting Looqta services..."

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "📦 Using PM2 to restart services..."
    
    # Restart backend
    echo "🔄 Restarting backend..."
    pm2 restart looqta-backend || pm2 start ecosystem.config.js --only looqta-backend
    
    # Restart frontend
    echo "🔄 Restarting frontend..."
    pm2 restart looqta-frontend || pm2 start ecosystem.config.js --only looqta-frontend
    
    echo "✅ Services restarted via PM2"
    pm2 list
else
    echo "⚠️  PM2 not found. Restarting manually..."
    
    # Kill existing processes
    echo "🛑 Stopping existing processes..."
    pkill -f "node.*src/index.js" || true
    pkill -f "next.*start" || true
    sleep 2
    
    # Start backend
    echo "🚀 Starting backend..."
    cd /opt/looqta/backend
    nohup npm start > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    
    # Start frontend (needs build first)
    echo "🚀 Building frontend..."
    cd /opt/looqta/frontend
    npm run build
    
    echo "🚀 Starting frontend..."
    nohup npm start > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
    
    echo "✅ Services started manually"
    echo "   Backend logs: /tmp/backend.log"
    echo "   Frontend logs: /tmp/frontend.log"
fi

echo ""
echo "⏳ Waiting 5 seconds for services to start..."
sleep 5

echo ""
echo "🧪 Testing services..."
echo ""

# Test backend
echo "Testing backend /roar endpoint..."
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/roar)
if [ "$BACKEND_TEST" = "200" ]; then
    echo "✅ Backend /roar endpoint: OK (200)"
else
    echo "❌ Backend /roar endpoint: FAILED ($BACKEND_TEST)"
fi

# Test frontend
echo "Testing frontend /roar page..."
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/roar)
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ Frontend /roar page: OK (200)"
else
    echo "❌ Frontend /roar page: FAILED ($FRONTEND_TEST)"
    echo "   Check logs: /tmp/frontend.log"
fi

echo ""
echo "✨ Done! Run 'node /opt/looqta/validate-roar-fix.js' to validate all endpoints."
