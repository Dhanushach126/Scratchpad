# Scratchpad — Architecture Reference

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    VERCEL (Free Hosting)                      │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              Vite + Vanilla JS Frontend                │  │
│  │                                                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │  Auth    │ │ Sidebar  │ │ Editors  │ │  Admin   │ │  │
│  │  │  Module  │ │  Module  │ │ Modules  │ │  Panel   │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │  │
│  │       │             │            │             │       │  │
│  │       └─────────────┴────────────┴─────────────┘       │  │
│  │                         │                              │  │
│  │              ┌──────────┴──────────┐                   │  │
│  │              │   supabase.js       │                   │  │
│  │              │   (SDK Client)      │                   │  │
│  │              └──────────┬──────────┘                   │  │
│  └─────────────────────────┼──────────────────────────────┘  │
└─────────────────────────────┼────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────┼────────────────────────────────┐
│                    SUPABASE (Free Tier)                       │
│  ┌──────────────────────────┴───────────────────────────┐    │
│  │                    API Gateway                        │    │
│  │              (Auto-generated REST API)                │    │
│  └──┬──────────────┬──────────────┬─────────────────────┘    │
│     │              │              │                           │
│  ┌──┴────┐    ┌────┴────┐   ┌────┴─────┐                    │
│  │ Auth  │    │ Postgre │   │ Storage  │                     │
│  │       │    │ SQL +   │   │ (Files)  │                     │
│  │ JWT   │    │ RLS     │   │          │                     │
│  └───────┘    └─────────┘   └──────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

## Module Dependency Graph

```
app.js (entry point)
├── supabase.js          ← Supabase client singleton
├── auth.js              ← Login/Register/Logout
│   └── supabase.js
├── sidebar.js           ← Pad list & navigation
│   ├── supabase.js
│   └── toast.js
├── editor.js            ← Note (Markdown) editor
│   ├── supabase.js
│   └── toast.js
├── code-editor.js       ← Code snippet editor
│   ├── supabase.js
│   └── toast.js
├── checklist.js         ← Checklist editor
│   ├── supabase.js
│   └── toast.js
├── file-pad.js          ← File upload/download
│   ├── supabase.js
│   └── toast.js
├── permissions-modal.js ← Share dialog
│   ├── supabase.js
│   └── toast.js
├── admin-panel.js       ← User management
│   ├── supabase.js
│   └── toast.js
├── theme.js             ← Theme toggle (no dependencies)
└── toast.js             ← Toast notifications (no dependencies)
```

## Data Flow

### Authentication Flow
```
User → auth.js → supabase.auth.signInWithPassword()
    → Supabase Auth returns JWT
    → JWT stored in browser (managed by Supabase SDK)
    → All subsequent queries include JWT automatically
    → RLS policies use auth.uid() from JWT to filter data
```

### Pad CRUD Flow
```
Create:  sidebar.js → supabase.from('pads').insert({ owner_id: auth.uid() })
Read:    sidebar.js → supabase.from('pads').select('*') → RLS filters results
Update:  editor.js  → supabase.from('pads').update({ content }).eq('id', padId)
Delete:  sidebar.js → supabase.from('pads').delete().eq('id', padId)
```

### Permission Flow
```
Grant:   permissions-modal.js → supabase.from('pad_permissions').insert()
Revoke:  permissions-modal.js → supabase.from('pad_permissions').delete()
Check:   Automatic via RLS — database rejects unauthorized operations
```

### File Upload Flow
```
Upload:  file-pad.js → supabase.storage.from('pad-files').upload(path, file)
    → Store file reference in pad's content JSONB
Download: file-pad.js → supabase.storage.from('pad-files').download(path)
    → Only accessible if user has pad permission (RLS + storage policy)
```

## State Management

No global state library — each module manages its own state:

| Module | State | Storage |
|---|---|---|
| `auth.js` | Current user session | Supabase SDK (auto-managed) |
| `sidebar.js` | Pad list, active pad ID | In-memory |
| `editor.js` | Current pad content, dirty flag | In-memory + Supabase |
| `theme.js` | Current theme (dark/light) | localStorage |
| `toast.js` | Active toast queue | In-memory |

## Security Model

| Layer | Mechanism |
|---|---|
| **Authentication** | Supabase Auth (bcrypt hashed passwords, JWT tokens) |
| **Authorization** | PostgreSQL Row Level Security (RLS) policies |
| **Transport** | HTTPS (enforced by Supabase + Vercel) |
| **Storage Access** | Supabase Storage policies (private bucket) |
| **XSS Prevention** | Markdown sanitization via marked.js, no `innerHTML` with raw user input |
| **CSRF** | Not applicable (JWT-based, no cookies for auth) |

## Performance Considerations

- **No build-time bundling of Supabase** — loaded as ESM from CDN or npm
- **Lazy loading** — editor modules loaded only when pad is opened
- **Debounced auto-save** — 1.5s after last keystroke to avoid excessive API calls
- **Optimistic UI** — sidebar updates immediately, syncs with server in background
- **CSS transitions** — GPU-accelerated `transform` and `opacity` only
