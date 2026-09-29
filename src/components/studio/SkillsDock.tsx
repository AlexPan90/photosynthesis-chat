import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronDown, GripVertical, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type SkillItem = { id: string; name: string; description: string };

/** 侧栏技能面板：拖到对话区或点击 ▶ 直接调用，结果以普通回复出现在当前对话。 */
export function SkillsDock({ userId, canInvoke }: { userId?: string | undefined; canInvoke: boolean }) {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(localStorage.getItem("relay-skills-dock") !== "0"); }, []);
  useEffect(() => {
    if (!userId) { setSkills([]); return; }
    const load = () => supabase.from("skills").select("id,name,description").eq("enabled", true).order("name").then(({ data }) => setSkills(data ?? []));
    load();
    // 安装/启用后（同页或其他标签页）即时同步
    const ch = supabase.channel(`skills-dock-${userId}`).on("postgres_changes", { event: "*", schema: "public", table: "skills" }, load).subscribe();
    window.addEventListener("focus", load);
    window.addEventListener("relay:skills-changed", load);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", load); window.removeEventListener("relay:skills-changed", load); };
  }, [userId]);
  if (!userId) return null;
  const toggle = () => setOpen(v => { localStorage.setItem("relay-skills-dock", v ? "0" : "1"); return !v; });
  const invoke = (s: SkillItem) => window.dispatchEvent(new CustomEvent("relay:invoke-skill", { detail: { name: s.name, description: s.description } }));

  return <div className="min-w-[224px] border-t px-3 pb-2 pt-3">
    <button type="button" onClick={toggle} className="mb-1.5 flex w-full items-center gap-1.5 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground">
      <span>技能</span><span className="rounded bg-muted px-1 font-mono text-[9.5px] normal-case tracking-normal">{skills.length}</span>
      <ChevronDown className={`ml-auto size-3.5 transition-transform ${open ? "" : "-rotate-90"}`}/>
    </button>
    {open && (skills.length ? <>
      <div className="soft-scroll max-h-44 space-y-0.5 overflow-y-auto">
        {skills.map(s => <div key={s.id} draggable title={`${s.description}\n\n拖到对话中调用`}
          onDragStart={e => { e.dataTransfer.setData("application/x-relay-skill", JSON.stringify({ name: s.name, description: s.description })); e.dataTransfer.effectAllowed = "copy"; }}
          className="group flex h-8 cursor-grab items-center gap-2 rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground active:cursor-grabbing">
          <GripVertical className="size-3 shrink-0 opacity-0 group-hover:opacity-60"/>
          <BookOpen className="size-3.5 shrink-0 text-primary"/>
          <span className="min-w-0 flex-1 truncate">{s.name}</span>
          {canInvoke && <button type="button" aria-label={`调用 ${s.name}`} onClick={() => invoke(s)} className="rounded p-0.5 opacity-0 hover:bg-primary/15 hover:text-primary focus:opacity-100 group-hover:opacity-100"><Play className="size-3"/></button>}
        </div>)}
      </div>
      <p className="px-2 pt-1.5 text-[10.5px] text-muted-foreground/70">{canInvoke ? "拖到对话里即可调用，输入框内容会作为任务" : "打开一个自己的对话后可拖入调用"}</p>
    </> : <Link to="/studio/skills" className="block px-2 py-2 text-[11.5px] text-muted-foreground hover:text-primary">还没有启用的技能，去安装 →</Link>)}
  </div>;
}
