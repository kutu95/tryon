# Finding Supabase Container Names

## Step 1: List All Supabase Containers

```bash
cd ~/supabase-local/supabase
docker ps --filter "name=supabase" --format "table {{.Names}}\t{{.Status}}"
```

Or see all containers:
```bash
docker ps
```

## Step 2: Check Auth Service Logs

Once you find the auth container name, use it directly:

```bash
# Replace CONTAINER_NAME with the actual name from docker ps
docker logs CONTAINER_NAME --tail 50
```

## Step 3: Check All Supabase Logs at Once

```bash
cd ~/supabase-local/supabase

# Find all supabase containers and show their logs
docker ps --filter "name=supabase" --format "{{.Names}}" | while read container; do
  echo "=== Logs for $container ==="
  docker logs "$container" --tail 20 2>&1 | grep -i "error\|400\|failed" || echo "No errors found"
  echo ""
done
```

## Step 4: Check Specific Services

The containers might be named differently. Common patterns:
- `supabase-auth-*`
- `supabase_auth_*`
- `supabase-auth-*` (with project ID)
- Just `auth` if using docker-compose

Try:
```bash
# List all containers
docker ps

# Or filter by image
docker ps --filter "ancestor=supabase/gotrue" --format "{{.Names}}"
```

