# Costume Stylist Virtual Try-On (2D) - MVP

A web application for costume styling that enables virtual try-on visualization. This MVP allows stylists to upload actor photos and garment images, generate 2D try-on previews, and organize results into look boards.

## Features

- **Actor Management**: Upload and manage actor photos
- **Garment Management**: Upload and manage garment images with categories
- **Virtual Try-On**: Generate 2D try-on previews using a swappable provider system
- **Look Boards**: Organize and compare try-on results
- **Role-Based Access**: Admin, Stylist, and Viewer roles with appropriate permissions
- **Private Storage**: All images stored in private Supabase buckets with signed URLs

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage (private buckets)
- **Authentication**: Supabase Auth

## Prerequisites

- Node.js 18+ and npm
- A Supabase account and project

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and API keys from Settings > API

### 2. Set Up Database Schema

1. In your Supabase project, go to SQL Editor
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Run the SQL script to create all tables, indexes, and RLS policies in the `tryon_schema` schema

**Note**: The migration creates a new schema called `tryon_schema` to namespace all application tables. This allows the application to coexist with other schemas in your database.

**Important for Local Supabase**: If you're using a local Supabase instance, ensure that the `tryon_schema` is exposed via PostgREST. The application code uses schema-qualified table names (e.g., `tryon_schema.actors`) in all database queries.

### 3. Create Storage Buckets

In Supabase Dashboard, go to Storage and create three private buckets:

1. **actors** - Private bucket for actor photos
2. **garments** - Private bucket for garment images
3. **tryons** - Private bucket for try-on results

For each bucket:
- Set it as **Private**
- No public access

### 4. Set Up Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   TRYON_PROVIDER=stub
   ```

   **Important**: Never commit `.env.local` to version control. The service role key has admin access.

### 5. Install Dependencies

```bash
npm install
```

### 6. Run Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

### 7. Create Your First User

1. Go to Supabase Dashboard > Authentication > Users
2. Click "Add user" and create a user with email/password
3. The user will automatically get a `viewer` role
4. To change roles, update the `profiles` table in the database:
   ```sql
   UPDATE profiles SET role = 'stylist' WHERE id = 'user-uuid';
   -- or 'admin' for full access
   ```

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── actors/            # Actor management pages
│   ├── garments/          # Garment management pages
│   ├── studio/            # Try-on studio page
│   ├── boards/            # Look boards pages
│   ├── api/               # API route handlers
│   └── login/             # Authentication page
├── components/            # React components
├── lib/                   # Utility functions
│   ├── supabase/         # Supabase client helpers
│   ├── auth.ts           # Authentication helpers
│   └── storage.ts        # Storage utilities
├── src/
│   └── server/
│       └── tryon/
│           └── providers/ # Try-on provider adapters
├── supabase/
│   └── migrations/       # Database migrations
└── documents/            # Project documentation
```

## Try-On Provider System

The application uses a provider adapter pattern to support multiple try-on services. Currently implemented:

- **Stub Provider** (`TRYON_PROVIDER=stub`): Returns the actor image as a placeholder, allowing the app to work end-to-end without a real provider.

To add a new provider:
1. Create a new provider class in `src/server/tryon/providers/`
2. Implement the `TryOnProvider` interface
3. Add the provider to the switch statement in `src/server/tryon/providers/index.ts`

## API Routes

- `POST /api/actors` - Create actor
- `GET /api/actors` - List actors
- `GET /api/actors/[id]` - Get actor
- `POST /api/actors/[id]/photos` - Upload actor photo
- `POST /api/garments` - Create garment
- `GET /api/garments` - List garments
- `GET /api/garments/[id]` - Get garment
- `POST /api/garments/[id]/images` - Upload garment image
- `POST /api/tryon` - Create try-on job
- `GET /api/tryon/[id]` - Get try-on job status
- `POST /api/look-boards` - Create look board
- `GET /api/look-boards` - List look boards
- `GET /api/look-boards/[id]` - Get look board
- `GET /api/look-boards/[id]/items` - Get look board items
- `POST /api/look-boards/[id]/items` - Add item to look board

## Security

- All storage buckets are private
- Signed URLs are used for image access (1-hour TTL by default)
- Row Level Security (RLS) is enabled on all tables
- Service role key is only used server-side
- Authentication required for all routes (except `/login`)

## Role Permissions

- **Admin**: Full access to all resources
- **Stylist**: Can create and edit actors, garments, try-on jobs, and look boards
- **Viewer**: Read-only access to all resources

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Deployment

This application can be deployed to Vercel:

1. Push your code to a Git repository
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

Make sure to set all environment variables in your deployment platform.

## Future Enhancements

- Real try-on provider integration (e.g., FASHN API)
- Image cropping tool
- Batch try-on processing
- Export look boards as ZIP
- Comments and collaboration features
- Image optimization and resizing
- Advanced filtering and search

## License

ISC

