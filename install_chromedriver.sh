#!/bin/bash
apt-get update
apt-get install -y chromium chromium-driver
ln -s /usr/lib/chromium/chromium /usr/bin/chrome
ln -s /usr/lib/chromium/chromedriver /usr/bin/chromedriver