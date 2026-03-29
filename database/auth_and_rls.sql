-- ============================================================
-- Auth helpers + RLS policies + auth trigger
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- These require elevated permissions not available via direct DB connection
-- ============================================================

-- Helper: get current user's org_id (public schema to avoid auth permission issues)
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT org_id FROM profiles WHERE id = auth.uid()
$$;

-- Helper: get current user's role (public schema to avoid auth permission issues)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================
-- Enable RLS on all org-scoped tables
-- ============================================================
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

-- ============================================================
-- RLS Policies (using public.user_org_id / public.user_role)
-- ============================================================

-- Organizations
CREATE POLICY "Users can view own org"
    ON organizations FOR SELECT
    USING (id = public.user_org_id());

-- Profiles
CREATE POLICY "Users can view org profiles"
    ON profiles FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Admins can manage org profiles"
    ON profiles FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Org Config
CREATE POLICY "Users can view org config"
    ON org_config FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Admins can manage org config"
    ON org_config FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- Clients
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

-- Service Entries
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

-- Follow-Ups
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

-- Appointments
CREATE POLICY "Users can view org appointments"
    ON appointments FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Staff can manage appointments"
    ON appointments FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

-- Documents
CREATE POLICY "Users can view org documents"
    ON documents FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "Users can upload documents"
    ON documents FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Staff can delete documents"
    ON documents FOR DELETE
    USING (org_id = public.user_org_id() AND public.user_role() IN ('staff', 'admin'));

-- Embeddings
CREATE POLICY "Users can view org embeddings"
    ON embeddings FOR SELECT
    USING (org_id = public.user_org_id());

CREATE POLICY "System can manage embeddings"
    ON embeddings FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Prompts
CREATE POLICY "Users can view prompts"
    ON prompts FOR SELECT
    USING (org_id IS NULL OR org_id = public.user_org_id());

CREATE POLICY "Admins can manage org prompts"
    ON prompts FOR ALL
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

-- AI Usage Log
CREATE POLICY "Admins can view AI usage"
    ON ai_usage_log FOR SELECT
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

CREATE POLICY "System can log AI usage"
    ON ai_usage_log FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Audit Log
CREATE POLICY "Admins can view audit log"
    ON audit_log FOR SELECT
    USING (org_id = public.user_org_id() AND public.user_role() = 'admin');

CREATE POLICY "System can write audit log"
    ON audit_log FOR INSERT
    WITH CHECK (org_id = public.user_org_id());

-- Client Summaries
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
-- Trigger: auto-create profile on Supabase Auth signup
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
