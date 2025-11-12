#!/bin/bash
# Install Chrome dependencies for Puppeteer
# This script installs the required libraries for Chrome/Chromium to run

set -e

echo "Installing Chrome dependencies for Puppeteer..."

# Detect OS
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
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
    echo "Dependencies installed successfully!"
elif [ -f /etc/redhat-release ]; then
    # RHEL/CentOS/Fedora
    yum install -y \
        nss \
        nspr \
        atk \
        at-spi2-atk \
        cups-libs \
        libdrm \
        libxkbcommon \
        libXcomposite \
        libXdamage \
        libXfixes \
        libXrandr \
        mesa-libgbm \
        alsa-lib \
        pango \
        cairo \
        at-spi2-atk \
        libxshmfence
    echo "Dependencies installed successfully!"
else
    echo "Unknown OS. Please install Chrome dependencies manually."
    echo "Required libraries: libnspr4, libnss3, libnssutil3, libsmime3, libatk-1.0.so.0"
    exit 1
fi
