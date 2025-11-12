# ROAR Admin System Setup Guide

## Quick Start

### 1. Database Migration
```bash
cd /opt/looqta
mysql -u looqta_dbuser -p looqta < sql/migrations/2025_add_roar_admin_system.sql
```

### 2. Initialize Admin User
```bash
cd backend
node init-roar-admin.js
```

### 3. Start Services

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Access Admin Console
Navigate to: **http://localhost:3000/roar**

**Default Login:**
- Username: `zaitme`
- Password: `highrise`

## Security Features

✅ **Password Security**
- Bcrypt hashing (12 rounds)
- Salted passwords
- Minimum 8 characters

✅ **Session Security**
- HTTP-only cookies
- 24-hour expiration
- Database-backed sessions
- Automatic cleanup

✅ **Account Protection**
- Auto-lock after 5 failed attempts
- 30-minute lockout period
- Failed attempt tracking

✅ **Input Security**
- XSS prevention
- SQL injection prevention
- Command injection prevention
- Input length limits

✅ **Audit Logging**
- All admin actions logged
- User tracking
- IP address logging
- Action details

## API Usage

### Login
```bash
curl -X POST http://localhost:4000/roar/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"zaitme","password":"highrise"}' \
  -c cookies.txt
```

### Get Current User
```bash
curl http://localhost:4000/roar/auth/me \
  -b cookies.txt
```

### Create User (requires super_admin)
```bash
curl -X POST http://localhost:4000/roar/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "username":"newuser",
    "password":"securepass123",
    "email":"user@example.com",
    "role":"admin"
  }'
```

### Generate API Token
```bash
curl -X POST http://localhost:4000/roar/tokens \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name":"My API Token",
    "description":"Token for API access",
    "expiresInDays":30
  }'
```

## Features

### User Management
- ✅ Create users
- ✅ Update users
- ✅ Change passwords
- ✅ Activate/deactivate accounts
- ✅ Role management (super_admin, admin, moderator)

### API Token Management
- ✅ Generate secure tokens
- ✅ Set expiration dates
- ✅ Track usage
- ✅ Revoke tokens

### Ad Placement Management
- ✅ Create ad placements
- ✅ Schedule ads
- ✅ Set priorities
- ✅ Track clicks/impressions

### System Management
- ✅ Scraper control
- ✅ Cache management
- ✅ System statistics
- ✅ Audit logging

## Troubleshooting

### Can't Login
1. Check database migration completed
2. Run `node backend/init-roar-admin.js`
3. Verify user exists: `SELECT * FROM admin_users WHERE username='zaitme'`
4. Check password hash is not 'PLACEHOLDER_WILL_BE_SET_BY_APP'

### Session Issues
1. Check cookies are enabled
2. Verify session table exists
3. Check session expiration time
4. Review browser console for errors

### Permission Denied
1. Verify user role in database
2. Check middleware authentication
3. Review audit log for details
4. Ensure session is valid

## Database Schema

### admin_users
- id, username, password_hash, salt
- email, full_name, role
- is_active, last_login
- failed_login_attempts, locked_until

### api_tokens
- id, user_id, token
- name, description, permissions
- last_used_at, expires_at
- is_active

### ad_placements
- id, name, position, ad_type
- content, image_url, link_url
- target_audience, start_date, end_date
- priority, click_count, impression_count

### admin_sessions
- id, user_id, session_token
- ip_address, user_agent
- expires_at

### admin_audit_log
- id, user_id, action
- resource_type, resource_id
- details, ip_address, user_agent

---

**Ready to use!** 🚀
