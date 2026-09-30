ALTER TABLE public.ai_models ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '', ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'gateway' CHECK (connection_type IN ('gateway','direct'));
CREATE TABLE public.ai_model_credentials (
  model_id uuid PRIMARY KEY REFERENCES public.ai_models(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  secret_enc text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ai_model_credentials TO service_role;
ALTER TABLE public.ai_model_credentials ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ai_model_credentials_touch BEFORE UPDATE ON public.ai_model_credentials FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();