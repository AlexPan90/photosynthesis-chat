ALTER TABLE public.mcp_connections ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{"connection_timeout_ms":15000,"request_timeout_ms":20000}'::jsonb;
ALTER TABLE public.mcp_connections ADD COLUMN IF NOT EXISTS extra_headers_enc text;
GRANT SELECT (settings), INSERT (settings), UPDATE (settings) ON public.mcp_connections TO authenticated;
GRANT INSERT (extra_headers_enc), UPDATE (extra_headers_enc) ON public.mcp_connections TO authenticated;
REVOKE SELECT (extra_headers_enc) ON public.mcp_connections FROM authenticated;