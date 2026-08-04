---
name: scratchpad-development
description: >
  Build, maintain, and extend the Scratchpad web application — a secure multi-user
  workspace with notes, code snippets, checklists, and file sharing. Uses Supabase
  (PostgreSQL, Auth, Storage, RLS) + Vite (vanilla JS) + Vercel hosting. Use this
  skill when working on any Scratchpad feature, bug fix, or enhancement.
---

# Scratchpad Development Skill

## Overview

Scratchpad is a **secure, multi-user workspace** web application for sharing sensitive information (API keys, code, credentials, images). It features:

- **4 Pad Types**: Notes (Markdown), Code (syntax-highlighted), Checklists, File collections
- **Per-Pad Permissions**: Owner, Editor (read/write), Viewer (read-only)
- **Admin System**: Global admin can manage all users and pads
- **Sensitive Data Handling**: Pads can be marked as sensitive with masked display
- **Premium UI**: Glassmorphism, dark/light themes, micro-animations

## Architecture

```
Frontend (Vite + Vanilla JS)
    ↕ Supabase JS SDK
Supabase (PostgreSQL + Auth + Storage + RLS)
    ↕ Hosted on Vercel (free tier)
```

### No Custom Backend

All backend logic is handled by Supabase:
- **Auth**: `supabase.auth.signUp()`, `signInWithPassword()`, `signOut()`
- **Database**: `supabase.from('pads').select()`, `.insert()`, `.update()`, `.delete()`
- **Storage**: `supabase.storage.from('pad-files').upload()`, `.download()`
- **Permissions**: Enforced at the database level via Row Level Security (RLS) policies

### Key Files

| File | Purpose |
|---|---|
| `js/supabase.js` | Supabase client singleton (reads env vars) |
| `js/app.js` | App init, auth state listener, routing, keyboard shortcuts |
| `js/auth.js` | Login/register/logout UI and session management |
| `js/sidebar.js` | Pad list, search, filters, new pad creation |
| `js/editor.js` | Note pad — Markdown editor with live preview |
| `js/code-editor.js` | Code pad — syntax highlighting with Prism.js |
| `js/checklist.js` | Checklist pad — interactive task list |
| `js/file-pad.js` | File pad — upload/download with Supabase Storage |
| `js/permissions-modal.js` | Share dialog — grant/revoke view/edit access |
| `js/admin-panel.js` | Admin panel — user management |
| `js/toast.js` | Toast notification system |
| `js/theme.js` | Dark/light theme toggle |
| `styles/index.css` | Design system — CSS custom properties, global styles |
| `styles/components.css` | Reusable component styles (buttons, modals, cards) |
| `styles/auth.css` | Login/register page styles |
| `styles/editor.css` | Editor-specific styles |
| `supabase/migration.sql` | Database schema, RLS policies, triggers |

### Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User profiles (extends `auth.users`) — username, role (admin/user) |
| `pads` | All pads — title, type, content (JSONB), owner, sensitive flag |
| `pad_permissions` | Per-pad access grants — user_id, pad_id, permission (view/edit) |
| `tags` | Tag names |
| `pad_tags` | Pad ↔ Tag junction table |

### Permission Model (RLS)

Supabase RLS policies enforce permissions at the SQL level:
- **SELECT**: User can read pads they own, have a `pad_permissions` row for, or are admin
- **UPDATE**: User can edit pads they own, have `edit` permission for, or are admin
- **DELETE**: Only owner or admin can delete pads
- **INSERT**: Any authenticated user can create pads (as owner)

## Development Workflow

### Adding a New Pad Type

1. Add the type to the `CHECK` constraint in `supabase/migration.sql`
2. Create a new JS module `js/<type>-pad.js` with `render()` and `save()` methods
3. Add CSS in `styles/editor.css`
4. Register the type in `js/app.js` routing logic
5. Add icon/color for the type in `js/sidebar.js`

### Adding a New Feature

1. Check if it requires a new database table or column → update `migration.sql`
2. Check if it needs new RLS policies → add to `migration.sql`
3. Frontend module → add in `js/`, import in `app.js`
4. Styles → add in appropriate CSS file, use design tokens from `index.css`

### Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Running Locally

```bash
npm install
# Create .env from .env.example with your Supabase credentials
npm run dev
```

### Deploying

```bash
# Push to GitHub → Vercel auto-deploys
# Or manually: npx vercel --prod
```

## Design Guidelines

- **Always use CSS custom properties** — never hardcode colors or spacing
- **Glassmorphism panels**: `background: var(--glass-bg)`, `backdrop-filter: blur(20px)`
- **Animations**: 200-300ms, `cubic-bezier(0.4, 0, 0.2, 1)`
- **Mobile breakpoint**: 768px — sidebar becomes overlay
- **Pad type colors**: Note=blue, Code=green, Checklist=amber, File=purple
- **Permission badge colors**: Edit=emerald, View=blue, Admin=red

## Common Patterns

### Supabase Query with Error Handling

```javascript
const { data, error } = await supabase
    .from('pads')
    .select('*')
    .eq('id', padId)
    .single();

if (error) {
    showToast('Failed to load pad', 'error');
    console.error(error);
    return;
}
```

### Auth-Gated Operations

```javascript
const { data: { user } } = await supabase.auth.getUser();
if (!user) {
    showAuthView();
    return;
}
```

### Permission Check (Frontend)

```javascript
// RLS handles the real enforcement — this is for UI-level gating
async function canEdit(padId) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: pad } = await supabase.from('pads').select('owner_id').eq('id', padId).single();
    if (pad.owner_id === user.id) return true;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile.role === 'admin') return true;

    const { data: perm } = await supabase.from('pad_permissions')
        .select('permission')
        .eq('pad_id', padId)
        .eq('user_id', user.id)
        .single();
    return perm?.permission === 'edit';
}
```

## Troubleshooting

| Issue | Fix |
|---|---|
| "Invalid API key" | Check `.env` — `VITE_SUPABASE_ANON_KEY` must match Supabase dashboard |
| RLS blocks all queries | Ensure RLS policies are applied in Supabase SQL Editor |
| Auth not working | Check Supabase Auth settings — email provider must be enabled |
| File upload fails | Create a `pad-files` storage bucket in Supabase dashboard |
| Styles not loading | Check Vite dev server is running, CSS files linked in `index.html` |
