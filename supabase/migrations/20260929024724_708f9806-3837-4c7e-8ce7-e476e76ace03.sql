ALTER TABLE public.agents
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN mcp_tool_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN skill_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN delegate_ids text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.mcp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  url text NOT NULL,
  auth_type text NOT NULL DEFAULT 'none',
  header_name text NOT NULL DEFAULT 'Authorization',
  secret_enc text,
  state text NOT NULL DEFAULT 'pending',
  last_error text,
  tools jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_tools text[] NOT NULL DEFAULT '{}',
  approval_tools text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mcp_connections TO authenticated;
GRANT ALL ON public.mcp_connections TO service_role;
ALTER TABLE public.mcp_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own mcp all" ON public.mcp_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mcp_touch BEFORE UPDATE ON public.mcp_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
REVOKE SELECT (secret_enc) ON public.mcp_connections FROM authenticated;

CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  ref text,
  path text,
  content text NOT NULL DEFAULT '',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills all" ON public.skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER skills_touch BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();