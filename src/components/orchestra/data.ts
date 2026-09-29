import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type McpConn = { id: string; name: string; url: string; auth_type: string; header_name: string; proxy_url: string | null; state: string; last_error: string | null; tools: { name: string; description: string }[]; disabled_tools: string[]; updated_at: string };
export type Skill = { id: string; name: string; description: string; source_type: string; source_url: string | null; ref: string | null; path: string | null; content: string; files: string[]; enabled: boolean; updated_at: string };

export function useMcpConnections() {
  const [items, setItems] = useState<McpConn[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("mcp_connections").select("id,name,url,auth_type,header_name,proxy_url,state,last_error,tools,disabled_tools,updated_at").order("created_at");
    setItems((data ?? []) as unknown as McpConn[]); setLoading(false);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { items, loading, reload };
}

export function useSkills() {
  const [items, setItems] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const { data } = await supabase.from("skills").select("id,name,description,source_type,source_url,ref,path,content,files,enabled,updated_at").order("created_at");
    setItems((data ?? []) as unknown as Skill[]); setLoading(false);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { items, loading, reload };
}
