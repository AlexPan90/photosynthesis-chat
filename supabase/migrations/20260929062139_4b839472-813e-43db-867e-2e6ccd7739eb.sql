ALTER TABLE public.threads ADD COLUMN goal text;
CREATE TABLE public.message_feedback (
  message_id text PRIMARY KEY,
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating smallint NOT NULL,
  comment text NOT NULL DEFAULT '',
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_feedback TO authenticated;
GRANT ALL ON public.message_feedback TO service_role;
ALTER TABLE public.message_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own feedback" ON public.message_feedback FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER feedback_touch BEFORE UPDATE ON public.message_feedback FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();