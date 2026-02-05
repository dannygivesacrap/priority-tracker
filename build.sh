#!/bin/bash
# Build script to inject environment variables into config.js

sed -i.bak \
    -e "s|FIREBASE_API_KEY_PLACEHOLDER|${FIREBASE_API_KEY}|g" \
    -e "s|GOOGLE_CLIENT_ID_PLACEHOLDER|${GOOGLE_CLIENT_ID}|g" \
    -e "s|GOOGLE_API_KEY_PLACEHOLDER|${GOOGLE_API_KEY}|g" \
    js/config.js

rm -f js/config.js.bak

echo "Build complete - environment variables injected"
