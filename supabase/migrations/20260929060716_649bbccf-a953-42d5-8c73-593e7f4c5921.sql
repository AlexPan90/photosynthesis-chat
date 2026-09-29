ALTER TABLE public.threads
  ADD COLUMN summary text,
  ADD COLUMN summary_upto text,
  ADD COLUMN permission text NOT NULL DEFAULT 'ask',
  ADD COLUMN plan_mode boolean NOT NULL DEFAULT false;