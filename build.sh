#!/bin/bash
# Build script to inject environment variables into config.js

echo "Starting build..."
echo "FIREBASE_API_KEY is set: $([ -n "$FIREBASE_API_KEY" ] && echo 'yes' || echo 'NO!')"
echo "GOOGLE_CLIENT_ID is set: $([ -n "$GOOGLE_CLIENT_ID" ] && echo 'yes' || echo 'NO!')"
echo "GOOGLE_API_KEY is set: $([ -n "$GOOGLE_API_KEY" ] && echo 'yes' || echo 'NO!')"

# Replace placeholders in config.js
sed -i "s|FIREBASE_API_KEY_PLACEHOLDER|${FIREBASE_API_KEY}|g" js/config.js
sed -i "s|GOOGLE_CLIENT_ID_PLACEHOLDER|${GOOGLE_CLIENT_ID}|g" js/config.js
sed -i "s|GOOGLE_API_KEY_PLACEHOLDER|${GOOGLE_API_KEY}|g" js/config.js

echo "Config after replacement:"
cat js/config.js

echo "Build complete!"
