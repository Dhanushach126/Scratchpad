<div align="center">
  
# 📝 Scratchpad

**An Executive, Multi-User Workspace for Knowledge & Collaboration**

[![License](https://img.shields.io/badge/license-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

Scratchpad is a secure, high-performance workspace designed for teams to share notes, code snippets, interactive checklists, and files. Built with a sleek, dual-tone glassmorphism UI, it features granular per-document permissions, deep security integrations, and seamless email invitations.

[**Explore the Docs**](#-quick-start) · [**Report Bug**](https://github.com/your-username/scratchpad/issues) · [**Request Feature**](https://github.com/your-username/scratchpad/issues)

</div>

---

## ✨ Key Features

- **📝 Rich Markdown Notes** — Powerful note editor with live HTML preview, sanitized with DOMPurify for enterprise-grade security against XSS.
- **💻 Syntax-Highlighted Code** — Beautiful code editor supporting over 20+ programming languages powered by Prism.js.
- **✅ Interactive Checklists** — Track task progress with dynamic completion bars, smooth animations, and drag-and-drop reordering (coming soon).
- **📁 Secure File Sharing** — Upload and manage documents and images with private bucket storage.
- **🔐 Granular Permissions** — Invite users via email to grant per-pad `Viewer` or `Editor` access. Unregistered users receive secure pending invitations.
- **👤 Admin Oversight** — Built-in Admin panel for user management and global workspace oversight.
- **🔒 Data Sensitivity** — Mark pads as "Sensitive" to enforce visual masking for over-the-shoulder privacy.
- **🌗 Dual-Tone UI** — A premium, unified interface featuring an Aurora Mesh gradient header and a deep charcoal editor canvas.

## 🛠️ Technology Stack

Scratchpad is built on a modern, lightweight, and blazingly fast stack:

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | Vanilla JS + Vite | Zero-framework architecture for absolute maximum performance. |
| **Backend & Auth** | Supabase | PostgreSQL, GoTrue (Auth), and Storage. |
| **Security** | Supabase RLS | Row Level Security policies enforced at the database level. |
| **Hosting** | Vercel | Seamless edge deployments. |
| **Design** | Custom CSS | Bespoke design system utilizing CSS variables and modern tokens. |

## 🚀 Quick Start

Get your own instance of Scratchpad running in less than 5 minutes.

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- A free [Supabase](https://supabase.com) account

### 1. Clone & Install

```bash
git clone https://github.com/your-username/scratchpad.git
cd scratchpad
npm install
```

### 2. Database Setup

1. Create a new project at [Supabase](https://supabase.com).
2. Navigate to the **SQL Editor** in your Supabase dashboard and execute the contents of [`supabase/migration.sql`](supabase/migration.sql).
3. Go to **Authentication → Providers** and ensure **Email Auth** is enabled.
4. Create a **Storage bucket** named `pad-files` and set it to **private**.

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Populate `.env` with your Supabase project credentials (found in **Settings → API**):

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:5173` in your browser. The first user to register will automatically be assigned the **Admin** role!

---

## 🔐 Permission Architecture

Scratchpad enforces strict access control through Supabase Row Level Security (RLS). 

| Role | Scope | Capabilities |
| :--- | :--- | :--- |
| **Admin** | Global | Full read/write access to all pads, manage users, modify any permissions. |
| **Owner** | Per-pad | Full control of their owned pads — edit, delete, share, and revoke access. |
| **Editor** | Per-pad | Edit pad content and upload associated files. |
| **Viewer** | Per-pad | Read-only access to view content and download files. |

## ⌨️ Productivity Shortcuts

| Windows / Linux | macOS | Action |
| :--- | :--- | :--- |
| `Ctrl + N` | `⌘ + N` | Create New Pad |
| `Ctrl + K` | `⌘ + K` | Focus Search Bar |
| `Ctrl + S` | `⌘ + S` | Save Current Pad |
| `Ctrl + B` | `⌘ + B` | **Bold** Text (in Markdown) |
| `Ctrl + I` | `⌘ + I` | *Italicize* Text (in Markdown) |

## 📁 Project Structure

```text
Scratchpad/
├── js/                     # Modular Vanilla JS application logic
│   ├── app.js              # Initialization & Routing
│   ├── auth.js             # Authentication workflows
│   ├── editor.js           # Markdown editor with DOMPurify
│   ├── permissions-modal.js# Sharing and pending invites
│   └── ...                 
├── styles/                 # Custom design system
│   ├── index.css           # Tokens & Theme variables
│   └── ...                 
├── supabase/
│   └── migration.sql       # PostgreSQL schema & RLS policies
├── index.html              # Application shell
├── vite.config.js          # Build configuration
└── package.json            # Dependencies
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
