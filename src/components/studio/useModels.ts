import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPPORTED_MODELS, type ConfiguredModel } from "@/lib/ai/model-catalog";

const EVENT = "relay-models-changed";
export const notifyModelsChanged = () => window.dispatchEvent(new Event(EVENT));

export function useModels(userId?: string) {
  const [models, setModels] = useState<ConfiguredModel[]>([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(async () => {
    if (!userId) { setModels([]); setLoaded(true); return; }
    const { data, error } = await supabase.from("ai_models").select("id,model_id,label,provider,verified_at,enabled,connection_type,version,description,parameters").eq("user_id", userId).order("created_at");
    if (error) { setLoaded(true); return; }
    if (!data?.length) {
      await supabase.from("ai_models").upsert(SUPPORTED_MODELS.map(m => ({ ...m, user_id: userId, verified_at: new Date().toISOString() })), { onConflict: "user_id,model_id", ignoreDuplicates: true });
      const { data: seeded } = await supabase.from("ai_models").select("id,model_id,label,provider,verified_at,enabled,connection_type,version,description,parameters").eq("user_id", userId).order("created_at");
      setModels((seeded ?? []) as unknown as ConfiguredModel[]);
    } else setModels(data as unknown as ConfiguredModel[]);
    setLoaded(true);
  }, [userId]);
  useEffect(() => { void reload(); window.addEventListener(EVENT, reload); return () => window.removeEventListener(EVENT, reload); }, [reload]);
  return { models, available: models.filter(m => m.enabled && m.verified_at), loaded, reload };
}
