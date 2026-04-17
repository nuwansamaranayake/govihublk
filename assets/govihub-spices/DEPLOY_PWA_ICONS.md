# Deploy Spices PWA Icons

Copy these files into the spices frontend public directory on the VPS:

```bash
# On VPS — copy icons
mkdir -p /opt/govihub-spices/govihub-web/public/icons/
cp icon-192x192.png /opt/govihub-spices/govihub-web/public/icons/
cp icon-512x512.png /opt/govihub-spices/govihub-web/public/icons/
cp icon-maskable-512x512.png /opt/govihub-spices/govihub-web/public/icons/

# Replace manifest
cp manifest.json /opt/govihub-spices/govihub-web/public/manifest.json

# Rebuild frontend (--no-cache!)
cd /opt/govihub-spices
docker compose -f docker-compose.spices.yml build --no-cache govihub-web-spices
docker compose -f docker-compose.spices.yml up -d govihub-web-spices

# Verify
curl -s https://spices.govihublk.com/manifest.json | python3 -m json.tool
# Should show "short_name": "GH Spices"
```

Note: Existing PWA installs on users' phones will pick up the new icon on their next visit (service worker update). New installs will see "GH Spices" immediately.
