CREATE TABLE public.ai_provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  provider text NOT NULL,
  secret_enc text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provider_connections TO authenticated;
GRANT ALL ON public.ai_provider_connections TO service_role;
ALTER TABLE public.ai_provider_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own provider connections" ON public.ai_provider_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_provider_connections_touch BEFORE UPDATE ON public.ai_provider_connections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();