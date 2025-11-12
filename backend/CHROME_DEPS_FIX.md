# Chrome Dependencies Fix

## Problem
Puppeteer's Chrome is missing required system libraries:
- libnspr4.so
- libnss3.so
- libnssutil3.so
- libsmime3.so
- libatk-1.0.so.0
- And others...

## Solution

### Option 1: Install Dependencies (Recommended)

Run the installation script:
```bash
cd /opt/looqta/backend
bash install-chrome-deps.sh
```

Or manually install:
```bash
# For Debian/Ubuntu
apt-get update
apt-get install -y \
    libnspr4 \
    libnss3 \
    libnssutil3 \
    libsmime3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libatspi2.0-0 \
    libxshmfence1

# Or install Chromium which includes all dependencies:
apt-get install -y chromium-browser
```

### Option 2: Use System Chrome/Chromium

If you have Chrome or Chromium installed system-wide, the scrapers will automatically detect and use it.

### Option 3: Docker Solution

If running in Docker, use a base image with Chrome pre-installed:
```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*
```

## Verification

After installing dependencies, restart the backend and check logs:
```bash
tail -f backend/logs/combined.log
```

You should see successful Chrome launches instead of library errors.

## Current Status

### Chrome Detection
The scrapers automatically detect and use:
1. **Puppeteer bundled Chrome** (preferred) - Located at `~/.cache/puppeteer/chrome/`
2. **System Chrome** (fallback) - Checks common paths:
   - `/usr/bin/google-chrome-stable`
   - `/usr/bin/google-chrome`
   - `/usr/bin/chromium`
   - `/usr/bin/chromium-browser`

### Log Messages
Successful Chrome detection shows:
```
Using Puppeteer bundled Chrome {"path":"/root/.cache/puppeteer/chrome/..."}
Amazon scraper initialized {"chromeExecutable":"...","headless":true}
Noon scraper initialized {"chromeExecutable":"...","headless":true}
```

### Common Errors

**Error**: `libnspr4.so: cannot open shared object file`
- **Solution**: Install Chrome dependencies (see Option 1 above)

**Error**: `Timed out after 30000 ms while waiting for the WS endpoint URL`
- **Solution**: Use Puppeteer bundled Chrome instead of system Chrome
- **Note**: System Chrome may have compatibility issues

**Error**: `Failed to launch the browser process`
- **Solution**: Check Chrome executable path and permissions
- **Solution**: Install missing system libraries

## Troubleshooting

### Check Chrome Installation
```bash
# Check if Chrome is accessible
which google-chrome
which chromium-browser

# Check Puppeteer Chrome
ls -la ~/.cache/puppeteer/chrome/
```

### Test Chrome Launch
```bash
cd backend
node -e "
const puppeteer = require('puppeteer');
puppeteer.launch({ headless: true })
  .then(browser => {
    console.log('Chrome launched successfully');
    return browser.close();
  })
  .catch(err => {
    console.error('Chrome launch failed:', err.message);
  });
"
```

---

**Last Updated**: 2025-11-10
