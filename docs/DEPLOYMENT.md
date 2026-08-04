# Deployment Guide — Scratchpad

## Deploy to Vercel (Recommended — Free)

### Option 1: GitHub Auto-Deploy (Easiest)

1. Push your code to a **GitHub repository**
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub
3. Click **"Add New Project"** → Import your Scratchpad repo
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add **Environment Variables**:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click **"Deploy"**

Every push to `main` will automatically redeploy.

### Option 2: CLI Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (follow prompts)
vercel

# Deploy to production
vercel --prod
```

## Custom Domain (Optional)

1. In Vercel dashboard → your project → **Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed by Vercel
4. SSL is automatic

## Environment Variables Checklist

| Variable | Where to Get It | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Settings → API → Project URL | ✅ |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public key | ✅ |

> ⚠️ Add these in **Vercel Dashboard → Settings → Environment Variables**, not in your code!

## Post-Deployment Checklist

- [ ] App loads at your Vercel URL
- [ ] Registration and login work
- [ ] First user is assigned admin role
- [ ] Pads can be created, edited, saved
- [ ] File uploads work
- [ ] Sharing/permissions work
- [ ] Theme toggle works
- [ ] Mobile layout is responsive

## Alternative Free Hosts

If you prefer a different platform:

| Platform | Notes |
|---|---|
| **Netlify** | Similar to Vercel — free tier, auto-deploy from GitHub |
| **Cloudflare Pages** | Unlimited bandwidth, very fast CDN |
| **GitHub Pages** | Static only — works but no SPA routing without a workaround |
