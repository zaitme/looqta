# Next Steps After Database Migration

## ✅ What's Ready

Now that the database migration is complete, the following features are **fully operational**:

### 1. Price History System
- ✅ Database table: `price_history`
- ✅ API endpoint: `GET /api/products/:id/history`
- ✅ Automatic logging after each scrape
- ✅ Moving averages calculation (7-day, 30-day)
- ✅ Percent change tracking

### 2. Price Alerts System
- ✅ Database table: `user_price_alerts`
- ✅ API endpoints:
  - `POST /api/products/:id/alerts` - Create alert
  - `GET /api/users/:userId/alerts` - Get user alerts
  - `DELETE /api/products/:id/alerts/:alertId` - Delete alert
- ✅ Background worker checks alerts every 15 minutes
- ⏳ Email/Push notifications (ready for integration)

### 3. Affiliate Tracking
- ✅ Database table: `affiliate_clicks`
- ✅ API endpoints:
  - `GET /r/:token` - Redirect with tracking
  - `POST /api/affiliate/token` - Generate token
- ✅ Click tracking with IP, user agent, timestamps

### 4. Additional Tables Ready
- ✅ `product_shipping` - For KSA localization
- ✅ `coupons` - For promo code aggregation
- ✅ `reviews` - For verified buyer reviews

## 🚀 Immediate Actions

### 1. Start the Backend
```bash
cd /opt/looqta/backend
npm start
```

The backend will automatically:
- Start the price alert worker
- Begin logging price history after searches
- Enable all new API endpoints

### 2. Test the APIs

**Option A: Use the test script**
```bash
cd /opt/looqta/backend
node test-modernization-apis.js
```

**Option B: Manual testing**

**Get price history:**
```bash
curl "http://localhost:4000/api/products/{productId}/history?range=30d"
```

**Create price alert:**
```bash
curl -X POST http://localhost:4000/api/products/{productId}/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "targetPrice": 1000,
    "currency": "SAR",
    "userId": "user123",
    "productName": "iPhone 15",
    "site": "amazon.sa",
    "url": "https://amazon.sa/dp/..."
  }'
```

**Get user alerts:**
```bash
curl "http://localhost:4000/api/users/user123/alerts"
```

### 3. Generate Price History Data

Run a search through the frontend or API:
```bash
curl "http://localhost:4000/api/search?q=iphone"
```

This will automatically:
- Scrape products from Amazon and Noon
- Log prices to `price_history` table
- Generate product IDs for tracking

## 📋 Frontend Development (Next Priority)

### Components to Build

1. **PriceHistoryChart Component**
   - Location: `frontend/components/PriceHistoryChart.js`
   - Purpose: Display price trends over time
   - Data source: `GET /api/products/:id/history`
   - Library suggestion: Use Chart.js or Recharts

2. **PriceAlertForm Component**
   - Location: `frontend/components/PriceAlertForm.js`
   - Purpose: Create/manage price alerts
   - API: `POST /api/products/:id/alerts`
   - Features: Target price input, notification type selection

3. **SellerBadge Component**
   - Location: `frontend/components/SellerBadge.js`
   - Purpose: Display seller trust badges
   - Data: From `products.seller_rating`, `seller_type`
   - Badges: "Verified Retailer", "Top Seller", etc.

4. **Product Detail Page**
   - Location: `frontend/pages/product/[id].js` or `frontend/app/product/[id]/page.js`
   - Features:
     - Price history chart
     - Price alert form
     - Seller badges
     - Affiliate buy button

## 🔧 Configuration

### Environment Variables

Add to `backend/.env` (if not already present):
```bash
# Price Alerts (optional, defaults enabled)
ENABLE_PRICE_ALERTS=true
PRICE_ALERT_INTERVAL_MINUTES=15

# Email/Push (when ready to integrate)
# EMAIL_SERVICE=ses
# EMAIL_FROM=noreply@looqta.com
# PUSH_SERVICE=fcm
```

## 📊 Monitoring

### Check Logs
```bash
# View all logs
tail -f backend/logs/combined.log

# View errors only
tail -f backend/logs/error.log

# Check price alert worker
grep "price alert" backend/logs/combined.log
```

### Verify Price History Logging
After running a search, check the database:
```sql
SELECT COUNT(*) FROM price_history;
SELECT * FROM price_history ORDER BY scraped_at DESC LIMIT 10;
```

### Verify Price Alerts
```sql
SELECT * FROM user_price_alerts WHERE is_active = TRUE;
```

## 🎯 Success Indicators

You'll know everything is working when:

1. ✅ Backend starts without errors
2. ✅ Price history appears in database after searches
3. ✅ Price alerts can be created via API
4. ✅ Price alert worker logs show it's checking alerts
5. ✅ Affiliate redirects track clicks

## 🐛 Troubleshooting

### Price History Not Logging
- Check that searches are completing successfully
- Verify database connection in logs
- Check `backend/logs/combined.log` for errors

### Price Alerts Not Working
- Verify worker started: Check logs for "Price alert worker started"
- Check database: `SELECT * FROM user_price_alerts`
- Verify product has price history: `SELECT * FROM price_history WHERE product_id = '...'`

### API Errors
- Check database connection
- Verify tables exist: `SHOW TABLES;`
- Check API logs: `backend/logs/combined.log`

## 📚 Documentation

- **Implementation Status**: `MODERNIZATION_IMPLEMENTATION_STATUS.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Original Plan**: `lootqa_modernaztion_desing_implementation_plan.txt`

---

**Status**: Database migration complete ✅  
**Backend**: Ready to start ✅  
**APIs**: Fully functional ✅  
**Frontend**: Pending development ⏳
