# Supabase Setup Guide for Scratchpad

This guide walks you through setting up Supabase as the backend for Scratchpad.

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (GitHub login works)
2. Click **"New Project"**
3. Choose your organization (or create one)
4. Fill in:
   - **Project name**: `scratchpad`
   - **Database password**: Choose a strong password (save it somewhere safe)
   - **Region**: Choose the closest to your users
5. Click **"Create new project"** and wait for it to initialize (~2 minutes)

## Step 2: Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Copy the entire contents of [`supabase/migration.sql`](../supabase/migration.sql)
4. Paste it into the SQL editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. You should see "Success. No rows returned" — this means all tables and policies are created

## Step 3: Get Your API Credentials

1. Go to **Settings** (gear icon) → **API**
2. Copy these two values:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **anon/public key**: `eyJhbGciOi...` (the long JWT string)
3. Create a `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> ⚠️ **Never commit your `.env` file to Git!** It's already in `.gitignore`.

## Step 4: Enable Email Authentication

1. Go to **Authentication** → **Providers**
2. Ensure **Email** is enabled
3. (Optional) Disable **"Confirm email"** for development — so you can sign up without email verification

## Step 5: Create the Storage Bucket

1. Go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Name it: `pad-files`
4. Set to **Private** (not public)
5. Click **"Create bucket"**

### Add Storage Policies

After creating the bucket, add these policies:

**Policy 1: Authenticated users can upload**
- Click on the `pad-files` bucket → **Policies** → **New Policy**
- Target: `INSERT`
- Policy: `authenticated` users can insert

**Policy 2: Authenticated users can read**
- Target: `SELECT`
- Policy: `authenticated` users can select

**Policy 3: Authenticated users can delete their uploads**
- Target: `DELETE`
- Policy: `authenticated` users can delete

## Step 6: Verify Setup

Run the app locally:

```bash
npm run dev
```

1. Open `http://localhost:5173`
2. Register a new account — this first user will automatically become **Admin**
3. Create a test pad and verify it saves
4. Check the Supabase dashboard → **Table Editor** to see the data

## Troubleshooting

| Issue | Solution |
|---|---|
| "Invalid API key" | Double-check `.env` values match the Supabase dashboard |
| "relation does not exist" | Run `migration.sql` again in the SQL Editor |
| Can't sign up | Enable Email provider in Authentication → Providers |
| File upload fails | Create the `pad-files` bucket in Storage |
| RLS blocking queries | Ensure all policies from migration.sql were applied |

## Free Tier Limits

| Resource | Limit |
|---|---|
| Database | 500 MB |
| Storage | 1 GB |
| Auth users | 50,000 MAU |
| API requests | Unlimited |
| Bandwidth | 2 GB/month |
| Edge Functions | 500,000 invocations/month |

These limits are very generous for a personal/team workspace tool.
