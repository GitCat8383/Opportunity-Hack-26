-- ============================================================
-- Nonprofit Client & Case Management Platform — Database Schema
-- Target: Supabase (PostgreSQL 15 + pgvector)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- 1. Organizations (multi-tenant root)
-- ============================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,              -- used in URLs / subdomain
    logo_url TEXT,
    settings JSONB DEFAULT '{}'::jsonb,     -- org-wide feature flags
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Profiles (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'volunteer'
        CHECK (role IN ('volunteer', 'staff', 'admin')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_org ON profiles(org_id);

-- ============================================================
-- 3. Org Config (custom fields, AI settings, budget caps)
--    1:1 with organizations — org_id is the primary key
-- ============================================================
CREATE TABLE org_config (
    org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    extra_fields_schema JSONB DEFAULT '[]'::jsonb,   -- JSON schema for custom client fields
    service_types JSONB DEFAULT '["General", "Food Assistance", "Housing", "Mental Health", "Legal", "Medical", "Education", "Other"]'::jsonb,
    ai_features_enabled JSONB DEFAULT '{"voice_notes": true, "photo_intake": true, "semantic_search": true, "handoff_summary": true, "follow_up_detection": true, "funder_reports": true, "translation": true}'::jsonb,
    ai_monthly_budget_cents INTEGER DEFAULT 5000,    -- $50 default cap
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 4. Clients
-- ============================================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE,
    phone TEXT,
    email TEXT,
    address TEXT,
    language TEXT DEFAULT 'en',
    gender TEXT,
    household_size INTEGER,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
    extra_fields JSONB DEFAULT '{}'::jsonb,    -- org-specific custom fields
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_org ON clients(org_id);
CREATE INDEX idx_clients_status ON clients(org_id, status);
CREATE INDEX idx_clients_name ON clients(org_id, last_name, first_name);

-- ============================================================
-- 5. Service Entries
-- ============================================================
CREATE TABLE service_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    service_date DATE NOT NULL DEFAULT CURRENT_DATE,
    service_type TEXT NOT NULL,
    notes TEXT,
    summary TEXT,                       -- AI-structured summary (if voice note)
    action_items JSONB DEFAULT '[]'::jsonb,
    risk_flags JSONB DEFAULT '[]'::jsonb,
    language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_entries_client ON service_entries(client_id);
CREATE INDEX idx_service_entries_org ON service_entries(org_id);
CREATE INDEX idx_service_entries_date ON service_entries(org_id, service_date DESC);

-- ============================================================
-- 6. Follow-Ups (AI-detected from case notes)
-- ============================================================
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    service_entry_id UUID REFERENCES service_entries(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    category TEXT,                      -- e.g. 'food-security', 'housing', 'medical'
    urgency TEXT DEFAULT 'medium'
        CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    due_date DATE,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'completed', 'dismissed')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_follow_ups_org ON follow_ups(org_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(org_id, status, urgency);
CREATE INDEX idx_follow_ups_assigned ON follow_ups(assigned_to, status);

-- ============================================================
-- 7. Appointments / Scheduling
-- ============================================================
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    service_type TEXT,
    status TEXT DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appointments_org ON appointments(org_id);
CREATE INDEX idx_appointments_schedule ON appointments(org_id, scheduled_at);
CREATE INDEX idx_appointments_staff ON appointments(staff_id, scheduled_at);

-- ============================================================
-- 8. Documents (Supabase Storage metadata)
-- ============================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    file_name TEXT NOT NULL,
    file_type TEXT,                     -- MIME type
    file_size INTEGER,                  -- bytes
    storage_path TEXT NOT NULL,         -- Supabase Storage path
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_client ON documents(client_id);

-- ============================================================
-- 9. Embeddings (pgvector for semantic search)
-- ============================================================
CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    service_entry_id UUID NOT NULL UNIQUE REFERENCES service_entries(id) ON DELETE CASCADE,
    embedding vector(768),             -- Gemini embedding-001 (output_dimensionality=768)
    content_snippet TEXT,              -- first ~500 chars for display
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_embeddings_org ON embeddings(org_id);

-- HNSW index for cosine similarity search
-- HNSW works on empty tables and is optimal for datasets under ~100K rows
CREATE INDEX idx_embeddings_vector ON embeddings
    USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- 10. Prompts Registry (versioned AI system prompts)
-- ============================================================
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global default
    feature TEXT NOT NULL,             -- 'structure_note', 'photo_intake', 'summarize', 'follow_ups', 'funder_report', 'translate'
    version INTEGER NOT NULL DEFAULT 1,
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one active prompt per feature per org
-- COALESCE handles NULL org_id (global defaults) so uniqueness is enforced globally too
CREATE UNIQUE INDEX idx_prompts_active
    ON prompts(COALESCE(org_id, '00000000-0000-0000-0000-000000000000'), feature)
    WHERE is_active = true;

-- ============================================================
-- 11. Translations Cache
--     Intentionally NOT org-scoped — shared global cache.
--     "First Name" → "Nombre" is the same for every org.
--     RLS is not enabled; any authenticated user can read/write.
-- ============================================================
CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_text TEXT NOT NULL,
    source_lang TEXT NOT NULL DEFAULT 'en',
    target_lang TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_translations_lookup ON translations(md5(source_text), source_lang, target_lang);

-- ============================================================
-- 12. AI Usage Log (cost tracking + privacy audit)
-- ============================================================
CREATE TABLE ai_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    feature TEXT NOT NULL,             -- 'transcribe', 'structure_note', 'photo_intake', 'embed', 'search', 'summarize', 'follow_ups', 'funder_report', 'translate'
    model TEXT NOT NULL,               -- 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-embedding-001'
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_cents NUMERIC(10,4) DEFAULT 0,
    input_hash TEXT,                   -- SHA-256 of input (privacy audit, no PII stored)
    output_hash TEXT,                  -- SHA-256 of output
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_org ON ai_usage_log(org_id, created_at DESC);

-- ============================================================
-- 13. Audit Log (CRUD actions, no PII values)
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,              -- 'create', 'update', 'delete'
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb, -- changed field names only, no values
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_org ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);

-- ============================================================
-- 14. Client Handoff Summaries (cached AI output)
-- ============================================================
CREATE TABLE client_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    generated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    summary_text TEXT NOT NULL,
    summary_structured JSONB,          -- { background, services_history, current_status, active_needs, risk_factors, next_steps }
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_client_summaries ON client_summaries(client_id, created_at DESC);

-- ============================================================
-- 15. RPC: Semantic search via cosine similarity
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_org_id UUID,
    match_threshold FLOAT DEFAULT 0.75,
    match_count INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    service_entry_id UUID,
    content_snippet TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.service_entry_id,
        e.content_snippet,
        1 - (e.embedding <=> query_embedding) AS similarity
    FROM embeddings e
    WHERE e.org_id = match_org_id
      AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================
-- 16. Auth Helper Functions (public schema to avoid auth permission issues)
-- ============================================================

-- Helper: get current user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- 17. Row-Level Security Policies
-- ============================================================

-- Enable RLS on all org-scoped tables
-- NOTE: translations table is intentionally excluded — it's a global shared cache
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_summaries ENABLE ROW LEVEL SECURITY;

-- Organizations: users can only see their own org
CREATE POLICY "Users can view own org"
    ON organizations FOR SELECT
    USING (id = public.user_org_id());

-- Profiles: users can see profiles in their org
CREATE POLICY "Users can view org profiles"
    ON profiles FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Admins can manage org profiles"
    ON profiles FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Org Config: admins can manage, all can read
CREATE POLICY "Users can view org config"
    ON org_config FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Admins can manage org config"
    ON org_config FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Clients: org-isolated, role-based write access
CREATE POLICY "Users can view org clients"
    ON clients FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Volunteers and staff can create clients"
    ON clients FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Staff can update clients"
    ON clients FOR UPDATE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

CREATE POLICY "Admins can delete clients"
    ON clients FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Service Entries: org-isolated
CREATE POLICY "Users can view org service entries"
    ON service_entries FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Users can create service entries"
    ON service_entries FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Staff can update service entries"
    ON service_entries FOR UPDATE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

CREATE POLICY "Admins can delete service entries"
    ON service_entries FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Follow-Ups: org-isolated
CREATE POLICY "Users can view org follow-ups"
    ON follow_ups FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "System and staff can create follow-ups"
    ON follow_ups FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Staff can update follow-ups"
    ON follow_ups FOR UPDATE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

CREATE POLICY "Admins can delete follow-ups"
    ON follow_ups FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Appointments: org-isolated
CREATE POLICY "Users can view org appointments"
    ON appointments FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Staff can manage appointments"
    ON appointments FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

-- Documents: org-isolated
CREATE POLICY "Users can view org documents"
    ON documents FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Users can upload documents"
    ON documents FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Staff can delete documents"
    ON documents FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

-- Embeddings: org-isolated, managed by backend service role
CREATE POLICY "Users can view org embeddings"
    ON embeddings FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "System can manage embeddings"
    ON embeddings FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Prompts: org-isolated + global defaults
CREATE POLICY "Users can view prompts"
    ON prompts FOR SELECT
    USING (org_id IS NULL OR org_id = public.user_org_id());

CREATE POLICY "Admins can manage org prompts"
    ON prompts FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- AI Usage Log: admins only
CREATE POLICY "Admins can view AI usage"
    ON ai_usage_log FOR SELECT
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

CREATE POLICY "System can log AI usage"
    ON ai_usage_log FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Audit Log: admins only
CREATE POLICY "Admins can view audit log"
    ON audit_log FOR SELECT
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

CREATE POLICY "System can write audit log"
    ON audit_log FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Client Summaries: org-isolated
CREATE POLICY "Users can view client summaries"
    ON client_summaries FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Staff can create summaries"
    ON client_summaries FOR INSERT
    WITH CHECK (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

CREATE POLICY "Staff can delete summaries"
    ON client_summaries FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

-- ============================================================
-- 18. Triggers: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_profiles_updated
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_org_config_updated
    BEFORE UPDATE ON org_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_clients_updated
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_service_entries_updated
    BEFORE UPDATE ON service_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_follow_ups_updated
    BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointments_updated
    BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 19. Triggers: audit log on clients and service_entries
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _action TEXT;
    _record_id UUID;
    _org_id UUID;
    _meta JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        _action := 'create';
        _record_id := NEW.id;
        _org_id := NEW.org_id;
        _meta := jsonb_build_object('table', TG_TABLE_NAME);
    ELSIF TG_OP = 'UPDATE' THEN
        _action := 'update';
        _record_id := NEW.id;
        _org_id := NEW.org_id;
        -- Log changed column names only (no PII values)
        SELECT jsonb_object_agg(key, null)
        INTO _meta
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) ->> key IS DISTINCT FROM to_jsonb(OLD) ->> key;
        _meta := COALESCE(_meta, '{}'::jsonb);
    ELSIF TG_OP = 'DELETE' THEN
        _action := 'delete';
        _record_id := OLD.id;
        _org_id := OLD.org_id;
        _meta := jsonb_build_object('table', TG_TABLE_NAME);
    END IF;

    INSERT INTO audit_log (org_id, user_id, action, table_name, record_id, metadata)
    VALUES (
        _org_id,
        auth.uid(),
        _action,
        TG_TABLE_NAME,
        _record_id,
        _meta
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_audit
    AFTER INSERT OR UPDATE OR DELETE ON clients
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER trg_service_entries_audit
    AFTER INSERT OR UPDATE OR DELETE ON service_entries
    FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- ============================================================
-- 20. Trigger: auto-create profile on Supabase Auth signup
--     New users get a profile with 'volunteer' role.
--     Admin must manually promote to 'staff' or 'admin'.
--     org_id must be set in user_metadata during signup.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, org_id, full_name, email, role)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data ->> 'org_id')::UUID,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'role', 'volunteer')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
