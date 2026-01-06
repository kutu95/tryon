# Investigating User Creation 400 Error

## Step 1: Check Browser Console for Detailed Error

When you try to create the user in Supabase Studio UI:
1. Open browser Developer Tools (F12)
2. Go to **Console** tab
3. Try creating the user again
4. Look for any error messages - they often contain more details than the UI shows
5. Also check the **Network** tab to see the actual API request/response

## Step 2: Check Supabase Logs

### Check PostgREST/Kong logs (API gateway):
```bash
# On your server, check Supabase logs
cd ~/supabase-local/supabase
docker logs supabase_kong_$(docker ps -q --filter "name=supabase_kong") --tail 100
```

### Check Auth service logs:
```bash
docker logs supabase_auth_$(docker ps -q --filter "name=supabase_auth") --tail 100
```

### Check Database logs:
```bash
docker logs supabase_db_$(docker ps -q --filter "name=supabase_db") --tail 100
```

## Step 3: Check Database Constraints and Triggers

Run this in Supabase Studio SQL Editor:

```sql
-- Check for any constraints on auth.users that might be causing issues
SELECT 
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass
ORDER BY contype, conname;

-- Check triggers on auth.users
SELECT 
    tgname AS trigger_name,
    tgtype::text AS trigger_type,
    tgenabled AS is_enabled,
    pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass;

-- Check if there are any unique constraints on email
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'users' AND schemaname = 'auth';
```

## Step 4: Check Auth Configuration

```sql
-- Check auth configuration
SELECT * FROM auth.config;

-- Check if there are any email validation rules
SELECT * FROM auth.schema_migrations;
```

## Step 5: Test with Minimal User Creation

Try creating a user with minimal fields to see if it's a specific field causing issues:

```bash
SERVICE_ROLE_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY ~/apps/tryon/.env.local | cut -d '=' -f2 | tr -d '"' | tr -d "'")

# Try with minimal payload
curl -v -X POST "http://localhost:54321/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123456"
  }' 2>&1 | tee /tmp/auth_response.log
```

## Step 6: Check for Existing User

The error might be because the user already exists:

```sql
-- Check if user already exists
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email = 'Kristinaknab79@gmail.com';

-- Check if profile exists
SELECT p.*, u.email
FROM tryon_schema.profiles p
JOIN auth.users u ON p.id = u.id
WHERE u.email = 'Kristinaknab79@gmail.com';
```

## Step 7: Check Trigger Function for Errors

The trigger might be failing. Check the function:

```sql
-- Check the trigger function definition
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'handle_new_user';

-- Test the trigger function manually (if possible)
-- This will show if there are any syntax or permission issues
```

## Step 8: Check for Schema Issues

```sql
-- Verify the tryon_schema exists and is accessible
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'tryon_schema';

-- Check if profiles table exists and has correct structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'tryon_schema' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;
```

## Step 9: Check Network Request Details

In browser DevTools > Network tab:
1. Filter by "users" or "auth"
2. Click on the failed request
3. Check:
   - **Request Headers** - Are all required headers present?
   - **Request Payload** - Is the JSON valid?
   - **Response** - What's the actual error message?
   - **Status Code** - Is it really 400 or something else?

## Step 10: Check Supabase Version and Known Issues

```bash
# Check Supabase version
cd ~/supabase-local/supabase
supabase --version

# Check if there are known issues with your version
```

## Common Causes of 400 Errors:

1. **Email already exists** - Check Step 6
2. **Password doesn't meet requirements** - Supabase requires min 6 chars
3. **Invalid email format** - Though "Kristinaknab79@gmail.com" looks valid
4. **Trigger failure** - The `handle_new_user` trigger might be failing (Step 7)
5. **Missing required fields** - Check if auth.users has required fields we're not providing
6. **Database constraint violation** - Check Step 3
7. **CORS or network issue** - Check browser console and network tab

## Next Steps After Investigation:

Once you identify the specific error:
1. Share the exact error message from browser console or logs
2. Share the database constraint/trigger information
3. We can then fix the root cause instead of working around it

