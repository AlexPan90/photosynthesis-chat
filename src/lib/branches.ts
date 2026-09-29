import type { UIMessage } from "ai";

export type VersionMeta = { parentId?: string; version?: number; regeneratedFrom?: string | null; createdAt?: string; selectedAt?: string; event?: string; model?: string; usage?: { input: number; output: number; reasoning?: number; total: number } };
export type Row = { id: string; role: string; parts: unknown; parent_id: string | null; metadata: unknown; selected_at: string | null; created_at: string };

export const metaOf = (m: UIMessage) => (m.metadata ?? {}) as VersionMeta;

/** 把数据库行拆成「当前显示的线性对话」+「每个提问下的全部回复版本」。 */
export function buildBranches(rows: Row[]) {
  const versions: Record<string, UIMessage[]> = {};
  const order: UIMessage[] = [];
  let lastUser: string | null = null;
  for (const r of rows) {
    const base = (r.metadata && typeof r.metadata === "object" ? r.metadata : {}) as VersionMeta;
    const msg: UIMessage = { id: r.id, role: r.role as UIMessage["role"], parts: r.parts as UIMessage["parts"], metadata: { ...base, createdAt: base.createdAt ?? r.created_at, selectedAt: r.selected_at ?? undefined } };
    if (r.role === "user") { lastUser = r.id; order.push(msg); continue; }
    const parent = r.parent_id ?? lastUser;
    if (!parent) { order.push(msg); continue; }
    (msg.metadata as VersionMeta).parentId = parent;
    (versions[parent] ??= []).push(msg);
  }
  const score = (m: UIMessage) => metaOf(m).selectedAt ?? metaOf(m).createdAt ?? "";
  const messages: UIMessage[] = [];
  for (const m of order) {
    messages.push(m);
    const list = versions[m.id];
    if (m.role === "user" && list?.length) messages.push(list.reduce((a, b) => (score(b) >= score(a) ? b : a)));
  }
  return { messages, versions };
}
