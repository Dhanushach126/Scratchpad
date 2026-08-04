-- ============================================================
-- SCRATCHPAD — Database Migration
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 1. PROFILES TABLE (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure email column exists if table was created previously
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

-- Index for username & email lookups (sharing/search)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- 2. PADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pads (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'Untitled',
    type TEXT NOT NULL CHECK (type IN ('note', 'code', 'checklist', 'file')),
    content JSONB NOT NULL DEFAULT '{}',
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    language TEXT DEFAULT 'javascript',
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pads_owner ON pads(owner_id);
CREATE INDEX IF NOT EXISTS idx_pads_type ON pads(type);
CREATE INDEX IF NOT EXISTS idx_pads_updated ON pads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_pads_title_trgm ON pads USING gin(title gin_trgm_ops);

-- ============================================================
-- 3. PAD PERMISSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS pad_permissions (
    id BIGSERIAL PRIMARY KEY,
    pad_id BIGINT NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pad_id, user_id)
);

-- Indexes for permission lookups
CREATE INDEX IF NOT EXISTS idx_pad_perms_pad ON pad_permissions(pad_id);
CREATE INDEX IF NOT EXISTS idx_pad_perms_user ON pad_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_pad_perms_lookup ON pad_permissions(user_id, pad_id);

-- ============================================================
-- 3.5. PENDING PERMISSIONS TABLE (for un-registered emails)
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_permissions (
    id BIGSERIAL PRIMARY KEY,
    pad_id BIGINT NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    permission TEXT NOT NULL CHECK (permission IN ('view', 'edit')),
    granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(pad_id, email)
);

CREATE INDEX IF NOT EXISTS idx_pending_perms_pad ON pending_permissions(pad_id);
CREATE INDEX IF NOT EXISTS idx_pending_perms_email ON pending_permissions(email);

-- ============================================================
-- 4. TAGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- ============================================================
-- 5. PAD TAGS JUNCTION
-- ============================================================
CREATE TABLE IF NOT EXISTS pad_tags (
    pad_id BIGINT NOT NULL REFERENCES pads(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (pad_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_pad_tags_pad ON pad_tags(pad_id);
CREATE INDEX IF NOT EXISTS idx_pad_tags_tag ON pad_tags(tag_id);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pad_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pad_tags ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. HELPER FUNCTIONS (SECURITY DEFINER to prevent RLS recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_pad_owner(_pad_id BIGINT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.pads
        WHERE id = _pad_id AND owner_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.can_view_pad(_pad_id BIGINT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.pads WHERE id = _pad_id AND owner_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.pad_permissions WHERE pad_id = _pad_id AND user_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin'
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_pad(_pad_id BIGINT, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.pads WHERE id = _pad_id AND owner_id = _user_id
    ) OR EXISTS (
        SELECT 1 FROM public.pad_permissions WHERE pad_id = _pad_id AND user_id = _user_id AND permission = 'edit'
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin'
    );
$$;

-- ============================================================
-- 8. RLS POLICIES — PROFILES
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
    ON profiles FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin"
    ON profiles FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

-- ============================================================
-- 9. RLS POLICIES — PADS
-- ============================================================

DROP POLICY IF EXISTS "pads_select_accessible" ON pads;
CREATE POLICY "pads_select_accessible"
    ON pads FOR SELECT
    TO authenticated
    USING (public.can_view_pad(id, auth.uid()));

DROP POLICY IF EXISTS "pads_insert_own" ON pads;
CREATE POLICY "pads_insert_own"
    ON pads FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "pads_update_authorized" ON pads;
CREATE POLICY "pads_update_authorized"
    ON pads FOR UPDATE
    TO authenticated
    USING (public.can_edit_pad(id, auth.uid()));

DROP POLICY IF EXISTS "pads_delete_owner_admin" ON pads;
CREATE POLICY "pads_delete_owner_admin"
    ON pads FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

-- ============================================================
-- 10. RLS POLICIES — PAD PERMISSIONS & PENDING PERMISSIONS
-- ============================================================

DROP POLICY IF EXISTS "pad_perms_select" ON pad_permissions;
CREATE POLICY "pad_perms_select"
    ON pad_permissions FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_pad_owner(pad_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "pad_perms_insert" ON pad_permissions;
CREATE POLICY "pad_perms_insert"
    ON pad_permissions FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_pad_owner(pad_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "pad_perms_update" ON pad_permissions;
CREATE POLICY "pad_perms_update"
    ON pad_permissions FOR UPDATE
    TO authenticated
    USING (
        public.is_pad_owner(pad_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "pad_perms_delete" ON pad_permissions;
CREATE POLICY "pad_perms_delete"
    ON pad_permissions FOR DELETE
    TO authenticated
    USING (
        public.is_pad_owner(pad_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "pending_perms_all" ON pending_permissions;
CREATE POLICY "pending_perms_all"
    ON pending_permissions FOR ALL
    TO authenticated
    USING (
        public.is_pad_owner(pad_id, auth.uid())
        OR public.is_admin(auth.uid())
    );

-- ============================================================
-- 11. RLS POLICIES — TAGS
-- ============================================================

DROP POLICY IF EXISTS "tags_select_authenticated" ON tags;
CREATE POLICY "tags_select_authenticated"
    ON tags FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "tags_insert_authenticated" ON tags;
CREATE POLICY "tags_insert_authenticated"
    ON tags FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ============================================================
-- 12. RLS POLICIES — PAD TAGS
-- ============================================================

DROP POLICY IF EXISTS "pad_tags_select" ON pad_tags;
CREATE POLICY "pad_tags_select"
    ON pad_tags FOR SELECT
    TO authenticated
    USING (public.can_view_pad(pad_id, auth.uid()));

DROP POLICY IF EXISTS "pad_tags_insert" ON pad_tags;
CREATE POLICY "pad_tags_insert"
    ON pad_tags FOR INSERT
    TO authenticated
    WITH CHECK (public.can_edit_pad(pad_id, auth.uid()));

DROP POLICY IF EXISTS "pad_tags_delete" ON pad_tags;
CREATE POLICY "pad_tags_delete"
    ON pad_tags FOR DELETE
    TO authenticated
    USING (public.can_edit_pad(pad_id, auth.uid()));

-- ============================================================
-- 13. FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on user signup & auto-claim pending permissions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    user_count INT;
    user_role TEXT;
    user_username TEXT;
BEGIN
    -- Count existing profiles to determine role
    SELECT COUNT(*) INTO user_count FROM public.profiles;

    -- First user becomes admin
    IF user_count = 0 THEN
        user_role := 'admin';
    ELSE
        user_role := 'user';
    END IF;

    -- Extract username from metadata or generate from email
    user_username := COALESCE(
        NEW.raw_user_meta_data ->> 'username',
        SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTR(NEW.id::text, 1, 4)
    );

    INSERT INTO public.profiles (id, username, email, display_name, role)
    VALUES (
        NEW.id,
        user_username,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'display_name', user_username),
        user_role
    )
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    -- Transfer any pending permissions for this email into pad_permissions
    INSERT INTO public.pad_permissions (pad_id, user_id, permission, granted_by)
    SELECT pad_id, NEW.id, permission, granted_by
    FROM public.pending_permissions
    WHERE LOWER(email) = LOWER(NEW.email)
    ON CONFLICT (pad_id, user_id) DO UPDATE SET permission = EXCLUDED.permission;

    -- Clean up transferred pending permissions
    DELETE FROM public.pending_permissions WHERE LOWER(email) = LOWER(NEW.email);

    RETURN NEW;
END;
$$;

-- Sync email for any existing profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email != u.email);

-- Trigger: fire after auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at on pads
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pads_updated_at ON pads;
CREATE TRIGGER pads_updated_at
    BEFORE UPDATE ON pads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();
