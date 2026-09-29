CREATE TABLE public.ai_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id text NOT NULL CHECK (length(model_id) BETWEEN 3 AND 120),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  provider text NOT NULL CHECK (length(provider) BETWEEN 1 AND 60),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, model_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_models TO authenticated;
GRANT ALL ON public.ai_models TO service_role;
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai models select" ON public.ai_models FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ai models insert" ON public.ai_models FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ai models update" ON public.ai_models FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own ai models delete" ON public.ai_models FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER ai_models_touch BEFORE UPDATE ON public.ai_models FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();