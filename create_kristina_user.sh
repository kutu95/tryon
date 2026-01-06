#!/bin/bash

# Script to create user Kristinaknab79@gmail.com using Supabase Admin API
# This bypasses the Studio UI 400 error

# Configuration
EMAIL="Kristinaknab79@gmail.com"
PASSWORD="TempPassword123!"
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set"
  echo "You can find it in your .env.local file or Supabase Studio > Settings > API"
  exit 1
fi

echo "Creating user: $EMAIL"
echo "Using Supabase URL: $SUPABASE_URL"

# Create user via Admin API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${SUPABASE_URL}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"${EMAIL}\",
    \"password\": \"${PASSWORD}\",
    \"email_confirm\": true
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
  echo "✅ User created successfully!"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  
  # Now create the admin profile
  echo ""
  echo "Creating admin profile..."
  
  # Get the user ID from the response
  USER_ID=$(echo "$BODY" | jq -r '.id' 2>/dev/null)
  
  if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
    echo "User ID: $USER_ID"
    echo ""
    echo "Now run this SQL in Supabase Studio SQL Editor:"
    echo ""
    echo "INSERT INTO tryon_schema.profiles (id, role, display_name)"
    echo "VALUES ('$USER_ID', 'admin', '$EMAIL')"
    echo "ON CONFLICT (id) DO UPDATE"
    echo "  SET role = 'admin',"
    echo "      display_name = '$EMAIL',"
    echo "      updated_at = NOW();"
  else
    echo "⚠️  Could not extract user ID. Please check the response above."
    echo "You can still create the profile by running the migration:"
    echo "  supabase migration up"
  fi
else
  echo "❌ Error creating user. HTTP Code: $HTTP_CODE"
  echo "Response: $BODY"
  
  # Check if user already exists
  if echo "$BODY" | grep -q "already registered" || echo "$BODY" | grep -q "already exists"; then
    echo ""
    echo "User may already exist. Creating admin profile..."
    echo "Run this SQL in Supabase Studio SQL Editor:"
    echo ""
    echo "INSERT INTO tryon_schema.profiles (id, role, display_name)"
    echo "SELECT id, 'admin', email"
    echo "FROM auth.users"
    echo "WHERE email = '$EMAIL'"
    echo "ON CONFLICT (id) DO UPDATE"
    echo "  SET role = 'admin',"
    echo "      display_name = '$EMAIL',"
    echo "      updated_at = NOW();"
  fi
  exit 1
fi

