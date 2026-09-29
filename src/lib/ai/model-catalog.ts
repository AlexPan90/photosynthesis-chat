export const SUPPORTED_MODELS = [
  { model_id: "openai/gpt-6-astra", label: "GPT-6 Astra", provider: "OpenAI" },
  { model_id: "openai/gpt-6-sol", label: "GPT-6 Sol", provider: "OpenAI" },
  { model_id: "openai/gpt-6-luna", label: "GPT-6 Luna", provider: "OpenAI" },
] as const;

export type LiveModel = string;
export type ConfiguredModel = { id: string; model_id: string; label: string; provider: string; verified_at: string | null; enabled: boolean };
export const modelLabel = (id: string) => SUPPORTED_MODELS.find(m => m.model_id === id)?.label ?? id;
export const isSupportedModel = (id: string) => SUPPORTED_MODELS.some(m => m.model_id === id);
