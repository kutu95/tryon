# Costume Stylist Virtual Try‑On (2D) — MVP Context Doc

## Goal
Build a web app MVP for costume styling that can:
- Store **Actors** (photos of a person/actor)
- Store **Garments/Costumes** (photos of clothing/costumes; flat lays and/or on‑model images)
- Generate **2D “virtual try‑on” concept previews**: render a selected garment onto a selected actor photo
- Save generated outputs into **Looks / Look Boards** for comparison and sharing

This is a **quick concept** 2D version (not size‑accurate tailoring). Primary users are stylists needing rapid visualization.

Target usage: ~**20 try‑ons per day** (low volume).

## Non‑Goals (for MVP)
- Perfect fit/sizing accuracy; measurements; pattern drafting
- Full 3D avatar, cloth physics simulation
- Multi‑view or video try‑on
- Enterprise identity / SSO
- Real‑time collaboration / commenting (nice-to-have later)

## Approach
Use a hosted **virtual try‑on API** (commercial provider) to avoid ML hosting.
App is designed so the try‑on provider is swappable via an adapter interface.

## Tech Stack (suggested)
- Frontend: **Next.js (App Router)** + TypeScript + Tailwind
- Backend: Next.js Route Handlers (or server actions) for API calls
- Auth + DB + Storage: **Supabase**
  - Auth: email/password for MVP (invite-only)
  - DB: Postgres via Supabase
  - Storage: Supabase Storage buckets for actor/garment images and outputs
- Deployment: Vercel (frontend + route handlers)

## Key UX Screens
1) **Login**
2) **Actors**
   - list + create
   - actor profile with photo library
3) **Garments**
   - list + create
   - garment detail with images + tags
4) **Try‑On Studio**
   - select actor photo + garment image
   - run try‑on
   - show job status + result
   - save to look board
5) **Look Boards**
   - create board per scene/day/character
   - add try‑on results (cards)
   - basic export (download images / zip later)

## Guardrails for Better Results (MVP)
- Actor photos: front-facing, torso visible, minimal occlusion, decent light
- Garment images: clear outline, contrasting background if possible
- First supported garment types: tops/jackets/dresses
- Provide a simple **crop tool** in UI (optional in MVP; can do later)

## Data Model (Supabase / Postgres)
### Tables
- `profiles`
  - `id` uuid (pk, references auth.users)
  - `role` text CHECK IN ('admin','stylist','viewer')
  - `display_name` text
  - timestamps

- `actors`
  - `id` uuid pk
  - `name` text
  - `notes` text
  - `created_by` uuid references profiles(id)
  - timestamps

- `actor_photos`
  - `id` uuid pk
  - `actor_id` uuid references actors(id) on delete cascade
  - `storage_path` text (Supabase Storage path)
  - `width` int, `height` int (optional)
  - `is_primary` boolean default false
  - `tags` text[] default '{}'
  - timestamps

- `garments`
  - `id` uuid pk
  - `name` text
  - `category` text (e.g., 'top','jacket','dress','pants','accessory')
  - `notes` text
  - `created_by` uuid references profiles(id)
  - timestamps

- `garment_images`
  - `id` uuid pk
  - `garment_id` uuid references garments(id) on delete cascade
  - `storage_path` text
  - `image_type` text (e.g., 'flat_lay','on_model','hanger','detail')
  - `tags` text[] default '{}'
  - timestamps

- `tryon_jobs`
  - `id` uuid pk
  - `actor_photo_id` uuid references actor_photos(id)
  - `garment_image_id` uuid references garment_images(id)
  - `provider` text (e.g., 'fashn')
  - `provider_job_id` text (nullable; if provider is async)
  - `status` text CHECK IN ('queued','running','succeeded','failed')
  - `error_message` text (nullable)
  - `result_storage_path` text (nullable)
  - `settings` jsonb (nullable; provider parameters)
  - `created_by` uuid references profiles(id)
  - timestamps

- `look_boards`
  - `id` uuid pk
  - `title` text
  - `description` text
  - `created_by` uuid references profiles(id)
  - timestamps

- `look_items`
  - `id` uuid pk
  - `look_board_id` uuid references look_boards(id) on delete cascade
  - `tryon_job_id` uuid references tryon_jobs(id) on delete set null
  - `label` text (optional; e.g., "Option A")
  - `notes` text
  - timestamps

### Storage buckets
- `actors` (private)
- `garments` (private)
- `tryons` (private)

Store only paths in DB; generate signed URLs for display.

## Security & Privacy (MVP)
- All buckets **private**
- Use signed URLs with short TTL for images
- Row Level Security (RLS):
  - `admin`: full access
  - `stylist`: create/read/update for most tables
  - `viewer`: read-only
- Add retention policy later (e.g., delete raw uploads after X days) if required.

## Try‑On Provider Adapter (important for swapping)
Define a provider interface:

- `submitTryOn({ actorImageUrl, garmentImageUrl, options }) -> { jobId?, resultUrl? }`
- `getTryOnStatus({ jobId }) -> { status, resultUrl?, error? }`

Support:
- **Sync providers** (immediate result URL)
- **Async providers** (poll status)

### Provider choice (MVP)
Use a commercial try‑on API (example: FASHN API).
Implementation should isolate provider logic in `src/server/tryon/providers/*`.

## Backend Job Flow
1) User selects actor photo + garment image and clicks “Generate”.
2) App creates `tryon_jobs` row with `queued`.
3) Backend route handler:
   - Creates signed URLs for input images
   - Calls provider `submitTryOn`
   - Updates `tryon_jobs` to `running` + store `provider_job_id` if async
4) Frontend polls `GET /api/tryon/:id` until succeeded/failed
5) On success:
   - Download result image (from provider) server-side
   - Upload to `tryons` bucket
   - Update `tryon_jobs.result_storage_path` and `status='succeeded'`
6) Frontend shows result and offers “Save to Look Board”

## API Routes (Next.js)
- `POST /api/actors` create actor
- `POST /api/actors/:id/photos` upload
- `POST /api/garments` create garment
- `POST /api/garments/:id/images` upload
- `POST /api/tryon` create job (actor_photo_id, garment_image_id, settings)
- `GET /api/tryon/:id` get job status + signed result URL
- `POST /api/look-boards` create board
- `POST /api/look-boards/:id/items` add try-on to board

## Frontend Pages (Next.js App Router)
- `/login`
- `/actors`
- `/actors/[id]`
- `/garments`
- `/garments/[id]`
- `/studio` (Try‑On Studio)
- `/boards`
- `/boards/[id]`

## UI Components
- Image upload widget with client-side preview + basic validation
- Card grids for actors/garments
- Try‑on job status indicator (queued/running/succeeded/failed)
- Result viewer with before/after
- Look board gallery

## Implementation Phases
### Phase 0 — Skeleton (day 1)
- Project scaffolding, auth, basic navigation shell

### Phase 1 — Library (day 2–3)
- Actors + garments CRUD
- Upload to storage + display via signed URLs

### Phase 2 — Try‑On (day 3–5)
- Provider adapter, create job, poll status, store outputs

### Phase 3 — Look Boards (day 5)
- Save outputs + basic board view

## Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `TRYON_PROVIDER` (e.g. 'fashn')
- `FASHN_API_KEY` (if using FASHN)
- `FASHN_API_URL` (if needed)
- `NEXT_PUBLIC_APP_NAME` (optional)

## Success Criteria (MVP)
- Can upload actor photo + garment image
- Can generate a try‑on image reliably
- Can save and browse results in look boards
- Private access; no public URLs; signed URLs only
