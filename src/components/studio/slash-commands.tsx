import { useEffect, useState, type KeyboardEvent, type RefObject } from "react";

export type SlashCommand = { name: string; desc: string; run: () => void };

/** 输入 "/" 唤起的快捷指令弹窗：过滤、键盘导航、选择执行。 */
export function useSlashCommands(
  commands: SlashCommand[],
  draft: string,
  setDraft: (v: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const [idx, setIdx] = useState(0);
  const filter = draft.startsWith("/") && !draft.includes(" ") ? draft.slice(1).toLowerCase() : null;
  const list = filter === null ? [] : commands.filter(c => c.name.startsWith(filter));
  const open = list.length > 0;
  useEffect(() => { setIdx(0); }, [filter]);

  function pick(cmd: SlashCommand) {
    cmd.run();
    setTimeout(() => textareaRef.current?.focus(), 0);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx(i => (i + 1) % list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx(i => (i - 1 + list.length) % list.length); }
    else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(list[Math.min(idx, list.length - 1)]!); }
    else if (e.key === "Escape") { e.preventDefault(); setDraft(""); }
  }

  const popup = open ? (
    <div className="absolute inset-x-0 bottom-full z-20 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg" role="listbox" aria-label="快捷指令">
      <div className="px-3 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Commands</div>
      <div className="soft-scroll max-h-[280px] overflow-y-auto p-1">
        {list.map((c, i) => (
          <button key={c.name} type="button" role="option" aria-selected={i === idx} onMouseEnter={() => setIdx(i)} onClick={() => pick(c)} className={`flex w-full items-baseline gap-3 rounded-md px-2.5 py-2 text-left text-[13px] ${i === idx ? "bg-accent" : ""}`}>
            <span className="shrink-0 font-semibold">{c.name}</span>
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{c.desc}</span>
          </button>
        ))}
      </div>
      <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground/70">↑↓ 选择 · Enter 确认 · Esc 关闭</div>
    </div>
  ) : null;

  return { popup, onKeyDown, open };
}
