# Debugging Supabase Studio 400 Error

The error is coming from `/api/platform/auth/default/users` which is Supabase Studio's internal API.

## Step 1: Get the Actual Error Response

In browser DevTools:
1. Go to **Network** tab
2. Clear the network log
3. Try creating the user again
4. Find the request to `/api/platform/auth/default/users`
5. Click on it
6. Go to **Response** tab (or **Preview** tab)
7. Copy the entire response - this will show the actual error message

## Step 2: Check Request Payload

In the same Network request:
1. Go to **Payload** tab (or **Request** tab)
2. Check what data is being sent
3. Verify the email format and password

## Step 3: Check Supabase Auth Service Logs

The Studio API likely calls the auth service. Check those logs:

```bash
cd ~/supabase-local/supabase

# Check auth service logs
docker logs supabase_auth_$(docker ps -q --filter "name=supabase_auth") --tail 100 | grep -i error

# Or see all recent logs
docker logs supabase_auth_$(docker ps -q --filter "name=supabase_auth") --tail 200
```

## Step 4: Check Kong/API Gateway Logs

The Studio API goes through Kong:

```bash
docker logs supabase_kong_$(docker ps -q --filter "name=supabase_kong") --tail 100 | grep -i "400\|error"
```

## Step 5: Try Direct Auth API (Bypass Studio)

Since Studio is giving a 400, try the direct auth API endpoint:

```bash
cd ~/apps/tryon
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Try the direct auth endpoint (not through Studio)
curl -v -X POST "http://localhost:54321/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "Kristinaknab79@gmail.com",
    "password": "TempPassword123!",
    "email_confirm": true
  }' 2>&1
```

The `-v` flag will show detailed request/response headers which might reveal the issue.

## Step 6: Check if Studio API Requires Different Authentication

The Studio API might need different credentials. Check your Supabase config:

```bash
cd ~/supabase-local/supabase
cat config.toml | grep -A 10 "\[studio\]"
```

## Step 7: Check Database for Partial User Creation

Sometimes the user gets partially created:

```sql
-- Check auth.users
SELECT id, email, email_confirmed_at, created_at, updated_at
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com';

-- Check if there's a profile (even if incomplete)
SELECT p.*, u.email
FROM tryon_schema.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'Kristinaknab79@gmail.com';
```

## Most Likely Causes:

1. **Email already exists** - Check Step 7
2. **Password validation** - Studio might have stricter rules
3. **Studio API configuration issue** - The `/api/platform/` endpoint might be misconfigured
4. **Database trigger failure** - The `handle_new_user` trigger might be failing silently

## Next Steps:

1. **Get the Network Response** (Step 1) - This is the most important
2. **Check Auth Logs** (Step 3) - Will show what the auth service actually received
3. **Try Direct API** (Step 5) - Bypasses Studio to see if it's a Studio-specific issue

Share the results from these steps, especially the Network Response tab content.

