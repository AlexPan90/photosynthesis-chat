CREATE TABLE public.delegate_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delegate_sessions TO authenticated;
GRANT ALL ON public.delegate_sessions TO service_role;
ALTER TABLE public.delegate_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own delegate sessions" ON public.delegate_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);