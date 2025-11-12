#!/bin/bash
# Start both backend and frontend services

echo "🚀 Starting Looqta Services..."
echo ""

# Check if PM2 is available
if command -v pm2 &> /dev/null; then
    echo "📦 Using PM2 to start services..."
    echo ""
    
    # Start both services using ecosystem config
    pm2 start ecosystem.config.js
    
    echo ""
    echo "✅ Services started via PM2"
    echo ""
    pm2 list
    echo ""
    echo "📋 Useful commands:"
    echo "   pm2 logs              # View logs"
    echo "   pm2 restart all       # Restart all services"
    echo "   pm2 stop all          # Stop all services"
    echo "   pm2 monit             # Monitor services"
else
    echo "⚠️  PM2 not found. Starting services manually..."
    echo ""
    
    # Start backend
    echo "🚀 Starting backend..."
    cd /opt/looqta/backend
    nohup npm start > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "   Backend PID: $BACKEND_PID"
    echo "   Logs: /tmp/backend.log"
    
    # Start frontend (needs build first)
    echo ""
    echo "🔨 Building frontend..."
    cd /opt/looqta/frontend
    npm run build
    
    echo ""
    echo "🚀 Starting frontend..."
    nohup npm start > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "   Frontend PID: $FRONTEND_PID"
    echo "   Logs: /tmp/frontend.log"
    
    echo ""
    echo "✅ Services started manually"
    echo ""
    echo "📋 To stop services:"
    echo "   kill $BACKEND_PID $FRONTEND_PID"
fi

echo ""
echo "⏳ Waiting 3 seconds for services to start..."
sleep 3

echo ""
echo "🧪 Testing services..."
echo ""

# Test backend
BACKEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health 2>/dev/null || echo "000")
if [ "$BACKEND_TEST" = "200" ]; then
    echo "✅ Backend: Running (http://localhost:4000)"
else
    echo "❌ Backend: Not responding (check logs)"
fi

# Test frontend
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$FRONTEND_TEST" = "200" ]; then
    echo "✅ Frontend: Running (http://localhost:3000)"
else
    echo "❌ Frontend: Not responding (check logs)"
fi

echo ""
echo "✨ Done!"
echo ""
echo "🔍 Validate ROAR endpoints:"
echo "   node /opt/looqta/validate-and-fix-roar.js"
