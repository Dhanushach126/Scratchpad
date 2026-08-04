# Scratchpad — Project Rules & Conventions

## Project Overview

**Scratchpad** is a secure, multi-user workspace web application for sharing notes, code snippets, checklists, and files — with granular per-pad permissions (view/edit), admin controls, and secure handling of sensitive data (API keys, credentials, images).

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | **Vite + Vanilla JS** | No framework (React, Vue, etc.) — plain HTML/CSS/JS with ES modules |
| Backend | **Supabase** (BaaS) | PostgreSQL, Auth, Storage, Row Level Security — no custom server |
| Database | **Supabase PostgreSQL** | Relational schema with RLS policies for permission enforcement |
| Auth | **Supabase Auth** | Email/password, JWT tokens, session management |
| File Storage | **Supabase Storage** | Image and file uploads with permission-gated access |
| Hosting | **Vercel** (frontend) | Free tier, auto-deploy from GitHub |
| Markdown | **marked.js** (CDN) | Markdown → HTML rendering for note pads |
| Syntax Highlighting | **Prism.js** (CDN) | Code syntax highlighting for code pads |
| Icons | **Lucide Icons** (CDN) | Lightweight, consistent icon set |
| Fonts | **Google Fonts** | Inter (UI) + JetBrains Mono (code) |

## Coding Standards

### JavaScript
- Use **ES modules** (`import`/`export`) — no CommonJS
- Use **`const`** by default, `let` when reassignment is needed, never `var`
- Use **async/await** for all asynchronous operations (no raw `.then()` chains)
- Use **template literals** for string interpolation
- Name files in **kebab-case**: `code-editor.js`, `permissions-modal.js`
- Name functions/variables in **camelCase**: `loadPadList()`, `currentPad`
- Name CSS classes in **kebab-case**: `.pad-card`, `.editor-toolbar`
- All DOM element IDs must be **unique and descriptive**: `#search-input`, `#new-pad-btn`

### CSS
- Use **CSS custom properties** (variables) for all colors, spacing, typography — defined in `styles/index.css`
- **Never hardcode colors** — always reference `var(--color-*)` tokens
- Use **glassmorphism** for panels: semi-transparent backgrounds + `backdrop-filter: blur()`
- All animations: **200-300ms** duration, `cubic-bezier` or `ease` timing
- Mobile-first responsive: sidebar collapses at `< 768px`

### Supabase
- All database queries go through the **Supabase JS SDK** (`@supabase/supabase-js`)
- **Never bypass RLS** — all permission checks happen at the database level
- Supabase client is initialized once in `js/supabase.js` and imported everywhere
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- SQL migrations live in `supabase/migration.sql`

## File Organization

```
Scratchpad/
├── .agents/                     # Agent config (skills, rules)
├── supabase/                    # Database migrations & SQL
│   └── migration.sql
├── js/                          # JavaScript modules
│   ├── supabase.js              # Supabase client singleton
│   ├── app.js                   # App init, routing, shortcuts
│   ├── auth.js                  # Login/Register/Logout
│   ├── sidebar.js               # Navigation & pad list
│   ├── editor.js                # Note (Markdown) editor
│   ├── code-editor.js           # Code snippet editor
│   ├── checklist.js             # Checklist/task editor
│   ├── file-pad.js              # File upload/download
│   ├── permissions-modal.js     # Share & access control
│   ├── admin-panel.js           # User management (admin)
│   ├── toast.js                 # Toast notifications
│   └── theme.js                 # Dark/light theme
├── styles/                      # CSS stylesheets
│   ├── index.css                # Design system & tokens
│   ├── components.css           # Reusable component styles
│   ├── auth.css                 # Auth page styles
│   └── editor.css               # Editor-specific styles
├── index.html                   # Single-page app shell
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

## Permission Model

| Role | Scope | Capabilities |
|---|---|---|
| **Admin** | Global | All CRUD on all pads, manage users, grant/revoke any permission |
| **Owner** | Per-pad | Full control over their pad — edit, delete, share, manage permissions |
| **Editor** | Per-pad | Edit content, upload files — cannot delete pad or manage permissions |
| **Viewer** | Per-pad | Read-only access — view content, download files |

## Design Tokens (Reference)

- **Dark BG**: `#0a0a1a` → `#1a1a2e` gradient
- **Light BG**: `#f8fafc` → `#e2e8f0`
- **Glass panels**: `rgba(255,255,255,0.05)` + `backdrop-filter: blur(20px)`
- **Accent coral**: `#e94560`
- **Accent blue**: `#4361ee`
- **Accent emerald**: `#10b981`
- **Sensitive amber**: `#f59e0b`
- **Admin red**: `#ef4444`
- **Font UI**: `'Inter', sans-serif`
- **Font Code**: `'JetBrains Mono', monospace`

## Key Decisions Log

1. **No custom backend** — Supabase handles auth, DB, storage, and permissions via RLS
2. **No frontend framework** — Vanilla JS with ES modules for simplicity and performance
3. **SQLite rejected** — Ephemeral filesystems on free hosts; Supabase PostgreSQL chosen instead
4. **AES encryption deferred** — Supabase RLS provides access control; client-side E2E encryption is Phase 2
5. **Canvas pad deferred** — Notes, code, checklists, files are the MVP; canvas is Phase 2
