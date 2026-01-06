# Supabase Schema Configuration

## Problem
PostgREST (the API layer that Supabase uses) by default only exposes the `public` schema. The error "Could not find the table 'public.actors' in the schema cache" means PostgREST is looking in `public`, but your tables are in `tryon_schema`.

**Important**: Once PostgREST exposes the schema, you use just the table name (e.g., `actors`), NOT `tryon_schema.actors`.

## Solution for Local Supabase

**CRITICAL**: You must configure PostgREST to expose the `tryon_schema` before the application will work.

1. **Find your Supabase config file**: 
   - If you're using Supabase CLI, it's usually at `supabase/config.toml` in your project root
   - If you don't have one, create it

2. **Add or update the `[api]` section**:

The correct format depends on your Supabase version. Try one of these:

**Option 1** (most common):
```toml
[api]
db_schemas = ["public", "tryon_schema"]
```

**Option 2** (if Option 1 doesn't work):
```toml
[api]
schemas = ["public", "tryon_schema"]
```

**Option 3** (older format):
```toml
[api]
db.schemas = ["public", "tryon_schema"]
```

**Important TOML syntax rules:**
- No newlines inside string values
- Arrays use square brackets: `["item1", "item2"]`
- Strings must be on a single line
- Use quotes around strings in arrays
- Make sure there are no extra spaces or special characters

**Example of a complete `[api]` section:**
```toml
[api]
enabled = true
port = 54321
db_schemas = ["public", "tryon_schema"]
```

3. **Restart your local Supabase instance**:
```bash
supabase stop
supabase start
```

4. **Verify the configuration worked** - Check the PostgREST logs to see if it loaded the schema:
```bash
supabase logs api
```

You should see messages indicating that `tryon_schema` was loaded.

## Solution for Hosted Supabase

For hosted Supabase projects, you need to configure this via the Supabase Dashboard:

1. Go to **Project Settings** → **API**
2. Look for **Schema** settings (this may require Supabase CLI or support contact)
3. Alternatively, you can use the Supabase CLI to update the config

Or contact Supabase support to expose the `tryon_schema` in your project's PostgREST configuration.

## After Configuration

Once PostgREST is configured to expose `tryon_schema`, the application code will automatically work because it uses just the table names (the schema prefix is handled by PostgREST).

## Verify Configuration

After restarting, test with:
```bash
curl http://localhost:54321/rest/v1/actors \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

If you get a 200 response (even if empty array `[]`), the schema is properly exposed.

**If you still get errors**, check:
1. The config file syntax is correct (TOML format)
2. Supabase was fully restarted (not just reloaded)
3. The schema name matches exactly: `tryon_schema` (case-sensitive)
4. Check PostgREST logs: `supabase logs api`

## Alternative: Quick Test Without Schema

If you want to test quickly, you can temporarily move tables to `public` schema, but this is NOT recommended for production. The separate schema is better for organization and security.

