import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown, ChevronRight, Headphones, Image as ImageIcon, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import harbor from "@/assets/story-harbor.jpg";
import lighthouse from "@/assets/story-lighthouse.jpg";
import tide from "@/assets/story-tide.jpg";

type Chapter = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  image: string;
  imageCaption: string;
  paragraphs: string[];
  parent?: string;
  choices?: { label: string; description: string; target: string }[];
};

const intro: Chapter = { id: "arrival", number: "序章", title: "潮声里的灯", subtitle: "所有故事，都从一封没有署名的信开始。", image: harbor, imageCaption: "插图 01 · 雨后的青屿港", paragraphs: [
    "青屿港的雨是在傍晚停的。沈知遥沿着湿漉漉的石阶走向海边，信封在她的大衣口袋里被海风吹得微微发皱。信上只有一句话：今晚九点，灯塔会再次亮起。",
    "父亲失踪的那年，灯塔便熄灭了。此后十二年，她再没有回过这里。港口的旧钟敲过八下，远处的塔顶忽然闪了一次，像有人在浓雾里眨了眨眼。",
    "她停在岔路口。左边的山径通往灯塔；右边的石阶延伸到退潮后的海滩。潮水正在一点点退去，露出父亲曾经标记过的礁石。",
  ], choices: [
    { label: "前往灯塔", description: "追寻突然亮起的灯光", target: "lighthouse" },
    { label: "沿海滩寻找", description: "查看退潮后露出的礁石", target: "shore" },
  ] };
const chapters: Chapter[] = [intro,
  { id: "lighthouse", parent: "arrival", number: "第一章 · A", title: "灯塔的来客", subtitle: "有些秘密，藏在光照不到的地方。", image: lighthouse, imageCaption: "插图 02 · 灯塔中的旧航海日志", paragraphs: [
    "铁门没有上锁。沈知遥推门进去时，旋梯上还残留着潮湿的脚印。桌上的煤油灯烧得正旺，一本航海日志摊开在灯下，旁边放着一把她小时候见过的铜钥匙。",
    "日志最后一页写着今天的日期。笔迹熟悉得令她不敢呼吸：潮汐表不会说谎，但写潮汐表的人会。钥匙的齿纹里卡着一粒细小的白沙。",
    "楼上传来一声轻响。她可以顺着脚印上楼，也可以先用钥匙打开桌角那只锁着的抽屉。",
  ], choices: [
    { label: "跟随脚印上楼", description: "看看是谁点亮了灯塔", target: "stairs" },
    { label: "打开锁着的抽屉", description: "先弄清父亲留下了什么", target: "drawer" },
  ] },
  { id: "shore", parent: "arrival", number: "第一章 · B", title: "退潮之后", subtitle: "海把它带走，也会把它送回来。", image: tide, imageCaption: "插图 03 · 退潮后的礁石与旧渔船", paragraphs: [
    "潮水退得比往年都快。沈知遥踩过一片被海水浸透的海草，在礁石间看见一只银灰色的小箱子。箱盖上刻着父亲常画的海鸟，锁孔里却没有钥匙。",
    "不远处的旧渔船上，船铃无风自响。她想起信纸背面的淡蓝色印记——那是父亲用来标注暗礁的符号。箱子底部正贴着一张同样颜色的纸。",
    "海水很快就会涨回来。她得决定，是带着箱子回港口找人帮忙，还是趁退潮走向那艘旧船。",
  ], choices: [
    { label: "带箱子回港口", description: "找人一起破解箱上的秘密", target: "harbor" },
    { label: "走向旧渔船", description: "循着船铃寻找线索", target: "boat" },
  ] },
  { id: "stairs", parent: "lighthouse", number: "第二章 · A1", title: "旋梯尽头", subtitle: "她终于听见一个熟悉的声音。", image: lighthouse, imageCaption: "插图 04 · 光束穿过灯塔旋梯", paragraphs: [
    "沈知遥握紧扶手，一步一步走上旋梯。最高一层的玻璃被海风吹得轻响，一个背影正站在灯室里，替灯芯挡住穿堂风。",
    "“你来了。”那声音与记忆里不同，苍老了一些，却仍能让她立刻认出来。她没有回答，只看向他手中的潮汐表——十二年的空白，此刻终于有了第一个答案。",
  ] },
  { id: "drawer", parent: "lighthouse", number: "第二章 · A2", title: "抽屉里的海图", subtitle: "一张地图，改写了所有已知的路线。", image: lighthouse, imageCaption: "插图 05 · 留在桌上的航海日志", paragraphs: [
    "铜钥匙转动时，抽屉发出一声轻响。里面没有信，只有一张手绘海图。父亲用红墨水圈出灯塔与海滩之间的一片浅水区，并写着：真正的入口，只有退潮时才会出现。",
    "她抬头望向窗外。灯光正落在那片露出的礁石上。原来父亲留下的不是答案，而是一条可以亲自走下去的路。",
  ] },
  { id: "harbor", parent: "shore", number: "第二章 · B1", title: "港口的守夜人", subtitle: "有人一直在等这只箱子。", image: harbor, imageCaption: "插图 06 · 青屿港的夜灯", paragraphs: [
    "老船匠看见箱盖上的海鸟，手里的茶杯停在半空。“这是你父亲的东西，”他说，“我以为它再也不会回来了。”",
    "他从柜子里取出半张旧照片。照片里除了父亲，还有一位站在灯塔下的陌生人。箱子的另一半故事，或许就藏在那个人手里。",
  ] },
  { id: "boat", parent: "shore", number: "第二章 · B2", title: "船铃的回声", subtitle: "那不是风，而是一个信号。", image: tide, imageCaption: "插图 07 · 旧渔船旁的低潮", paragraphs: [
    "旧渔船早已搁浅，船铃却仍在轻轻摇晃。沈知遥爬上甲板，发现铃绳一直通向船舱下方。那里藏着一个小小的收发装置，指示灯正有节奏地闪烁。",
    "她照着节奏记下信号，拼成三个字：看灯塔。远处，那束温暖的光恰好转向她，像是在为她指路。",
  ] },
];
const byId = Object.fromEntries(chapters.map(c => [c.id, c])) as Record<string, Chapter>;
const branches = [
  { root: "lighthouse", children: ["stairs", "drawer"] },
  { root: "shore", children: ["harbor", "boat"] },
];

const speeds = [0.75, 1, 1.25, 1.5];
function formatTime(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }

function NarrationControls({ title, progress, duration, speed, playing, paused, error, onPlay, onPause, onStop, onSeek, onSpeed }: {
  title: string; progress: number; duration: number; speed: number; playing: boolean; paused: boolean; error: string;
  onPlay: () => void; onPause: () => void; onStop: () => void; onSeek: (value: number) => void; onSpeed: (value: number) => void;
}) {
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const shown = scrubbing ?? progress;
  return <div className="min-w-0" aria-label="本章配音控制">
    <div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[11px] font-medium">{title} · 中文朗读</span><span className="shrink-0 text-[10px] text-muted-foreground">语音合成</span></div>
    <div className="mt-3 flex items-center gap-2.5"><Button variant="outline" size="icon-sm" className="size-8 shrink-0 rounded-full" aria-label={playing ? "暂停朗读" : paused ? "继续朗读" : "播放朗读"} onClick={playing ? onPause : onPlay}>{playing ? <Pause className="size-3.5"/> : <Play className="size-3.5"/>}</Button><Slider aria-label="朗读进度" value={[shown]} min={0} max={100} step={1} onValueChange={v => setScrubbing(v[0] ?? 0)} onValueCommit={v => { onSeek(v[0] ?? 0); setScrubbing(null); }} className="min-w-0 flex-1"/>{(playing || paused) && <Button variant="ghost" size="icon-sm" className="size-7 shrink-0" aria-label="停止朗读" onClick={onStop}><Square className="size-3"/></Button>}</div>
    <div className="mt-1.5 flex items-center justify-between gap-2"><span className="font-mono text-[10px] tabular-nums text-muted-foreground">约 {formatTime(duration * shown / 100)} / {formatTime(duration)}</span><label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">速度<select aria-label="播放速度" value={speed} onChange={e => onSpeed(Number(e.target.value))} className="rounded border bg-background px-1 py-0.5 text-[10px] text-foreground">{speeds.map(value => <option key={value} value={value}>{value}×</option>)}</select></label></div>
    {error && <p role="status" className="mt-2 text-[11px] text-destructive">{error}</p>}
  </div>;
}

export function StoryReader() {
  const [selected, setSelected] = useState("arrival");
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const speechRun = useRef(0);
  const offset = useRef(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ lighthouse: true, shore: true });
  const scrollRef = useRef<HTMLDivElement>(null);
  const positions = useRef<Record<string, number>>({});
  const chapter = byId[selected] ?? intro;
  const narration = [chapter.title, ...chapter.paragraphs].join("。 ");
  const duration = Math.max(1, Math.ceil(narration.length / (4 * speed)));
  useEffect(() => { return () => { speechRun.current += 1; if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }; }, []);
  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      if (!window.speechSynthesis?.speaking) return;
      offset.current = Math.min(narration.length - 1, offset.current + speed);
      setProgress(offset.current / narration.length * 100);
    }, 250);
    return () => window.clearInterval(interval);
  }, [playing, selected, speed, narration.length]);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = positions.current[selected] ?? 0;
  }, [selected]);
  function select(id: string) {
    if (!byId[id] || id === selected) return;
    positions.current[selected] = scrollRef.current?.scrollTop ?? 0;
    speechRun.current += 1; window.speechSynthesis?.cancel(); offset.current = 0; setProgress(0); setPlaying(false); setPaused(false); setVoiceError("");
    setSelected(id);
  }
  function startAt(start: number, rate = speed) {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") { setVoiceError("当前浏览器不支持语音朗读"); return; }
    speechRun.current += 1;
    const run = speechRun.current;
    window.speechSynthesis.cancel();
    const position = Math.min(Math.max(0, Math.floor(start)), narration.length - 1);
    offset.current = position;
    setProgress(position / narration.length * 100);
    setVoiceError("");
    const utterance = new SpeechSynthesisUtterance(narration.slice(position));
    utterance.lang = "zh-CN"; utterance.rate = rate;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith("zh"));
    if (voice) utterance.voice = voice;
    utterance.onboundary = event => { if (speechRun.current !== run) return; offset.current = Math.min(position + event.charIndex, narration.length); setProgress(offset.current / narration.length * 100); };
    utterance.onend = () => { if (speechRun.current !== run) return; offset.current = narration.length; setProgress(100); setPlaying(false); setPaused(false); };
    utterance.onerror = event => { if (speechRun.current !== run) return; setPlaying(false); setPaused(false); if (event.error !== "canceled" && event.error !== "interrupted") setVoiceError("朗读暂时不可用，请检查浏览器语音设置"); };
    window.speechSynthesis.speak(utterance); setPlaying(true); setPaused(false);
  }
  function play() {
    if (paused && window.speechSynthesis?.paused) { window.speechSynthesis.resume(); setPaused(false); setPlaying(true); return; }
    startAt(offset.current >= narration.length ? 0 : offset.current);
  }
  function pause() { window.speechSynthesis?.pause(); setPaused(true); setPlaying(false); }
  function stop() { speechRun.current += 1; window.speechSynthesis?.cancel(); offset.current = 0; setProgress(0); setPaused(false); setPlaying(false); }
  function seek(value: number) {
    const next = Math.round(narration.length * value / 100);
    const wasPlaying = playing;
    speechRun.current += 1; window.speechSynthesis?.cancel();
    offset.current = next; setProgress(value); setPaused(false); setPlaying(false);
    if (wasPlaying && next < narration.length) startAt(next);
  }
  function changeSpeed(value: number) { setSpeed(value); if (playing) startAt(offset.current, value); else if (paused) { speechRun.current += 1; window.speechSynthesis?.cancel(); setPaused(false); } }
  const controls = { title: chapter.title, progress, duration, speed, playing, paused, error: voiceError, onPlay: play, onPause: pause, onStop: stop, onSeek: seek, onSpeed: changeSpeed };
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <nav aria-label="章节树" className="soft-scroll hidden w-[216px] shrink-0 overflow-y-auto border-r bg-sidebar/45 px-3 py-6 md:block xl:w-[238px]">
        <div className="mb-5 flex items-center justify-between px-2"><span className="text-[10px] font-semibold uppercase text-muted-foreground">故事目录</span><span className="font-mono text-[10px] text-muted-foreground">07 节</span></div>
        <p className="mb-2 px-2 text-[10px] text-muted-foreground">主线</p>
        <Button variant="ghost" aria-current={selected === "arrival" ? "page" : undefined} onClick={() => select("arrival")} className={`mb-5 h-auto w-full justify-start px-2 py-2 text-left text-xs ${selected === "arrival" ? "bg-accent font-semibold" : "text-muted-foreground"}`}><BookOpen className="mr-2 size-3.5 shrink-0"/>序章 · 潮声里的灯</Button>
        <p className="mb-2 px-2 text-[10px] text-muted-foreground">故事分支</p>
        {branches.map(branch => { const root = byId[branch.root] ?? intro; return <div key={root.id} className="mb-2">
          <div className="flex items-center"><Button variant="ghost" size="icon-sm" className="size-6 shrink-0" aria-label={`${expanded[root.id] ? "收起" : "展开"}${root.title}分支`} onClick={() => setExpanded(p => ({ ...p, [root.id]: !p[root.id] }))}>{expanded[root.id] ? <ChevronDown className="size-3"/> : <ChevronRight className="size-3"/>}</Button><Button variant="ghost" aria-current={selected === root.id ? "page" : undefined} onClick={() => select(root.id)} className={`h-auto min-w-0 flex-1 justify-start px-1 py-2 text-left text-xs ${selected === root.id ? "bg-accent font-semibold" : "text-muted-foreground"}`}><span className="truncate">{root.number} · {root.title}</span></Button></div>
          {expanded[root.id] && <div className="ml-3 border-l pl-2">{branch.children.map(id => { const c = byId[id] ?? intro; return <Button key={id} variant="ghost" aria-current={selected === id ? "page" : undefined} onClick={() => select(id)} className={`h-auto w-full justify-start px-2 py-2 text-left text-[11px] ${selected === id ? "bg-accent font-semibold" : "text-muted-foreground"}`}><span className="truncate">{c.number} · {c.title}</span></Button>; })}</div>}
        </div>; })}
      </nav>
       <div ref={scrollRef} onScroll={e => { positions.current[selected] = e.currentTarget.scrollTop; }} className="soft-scroll min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[780px] px-5 pb-24 pt-7 sm:px-8 lg:px-12">
          <div className="mb-6 flex items-center justify-between gap-3 border-b pb-4"><div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground"><BookOpen className="size-3.5 text-file-doc"/><span className="truncate">潮汐来信</span><ChevronRight className="size-3 shrink-0"/><span className="truncate text-foreground">{chapter.number}</span></div><span className="shrink-0 font-mono text-[10px] text-muted-foreground">互动故事 · 示例</span></div>
          <div className="mb-5 md:hidden"><label htmlFor="story-chapter" className="mb-1.5 block text-[11px] text-muted-foreground">选择章节与分支</label><select id="story-chapter" value={selected} onChange={e => select(e.target.value)} className="h-9 w-full rounded-md border bg-background px-3 text-xs text-foreground">{chapters.map(c => <option key={c.id} value={c.id}>{c.number} · {c.title}</option>)}</select></div>
           <div key={chapter.id} className="story-enter">
            <div className="mb-5 flex items-center gap-3"><span className="h-px w-7 bg-file-doc"/><span className="font-mono text-[10px] uppercase text-file-doc">{chapter.number}</span></div>
            <h1 className="text-[28px] font-semibold leading-tight text-foreground sm:text-[34px]">{chapter.title}</h1>
            <p className="mt-3 text-[13px] text-muted-foreground">{chapter.subtitle}</p>
            <figure className="mt-8 overflow-hidden rounded-md border bg-muted"><img src={chapter.image} alt={chapter.imageCaption.replace(/^插图 \d+ · /, "")} width={1280} height={832} className="aspect-[16/9] w-full object-cover"/><figcaption className="flex items-center gap-2 border-t px-3 py-2 text-[10px] text-muted-foreground"><ImageIcon className="size-3 text-file-image"/>{chapter.imageCaption}</figcaption></figure>
            <div className="mt-9 max-w-[620px] space-y-6 text-[15px] leading-[2.15] text-foreground/90">{chapter.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div>
            {chapter.choices ? <section className="mt-12 border-t pt-6" aria-label="选择故事走向"><div className="mb-4 flex items-center gap-2"><span className="size-1.5 rounded-full bg-file-doc"/><h2 className="text-xs font-semibold">接下来，你会怎么做？</h2></div><div className="grid gap-2 sm:grid-cols-2">{chapter.choices.map((choice, i) => <Button key={choice.target} variant="outline" onClick={() => select(choice.target)} className="group h-auto min-h-[76px] justify-start gap-3 whitespace-normal rounded-md px-4 py-3 text-left shadow-none transition-colors hover:border-file-doc/50 hover:bg-file-doc/5"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] text-muted-foreground">{String.fromCharCode(65 + i)}</span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{choice.label}</span><span className="mt-1 block text-[11px] font-normal text-muted-foreground">{choice.description}</span></span><ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"/></Button>)}</div></section> : <div className="mt-12 flex items-center justify-between gap-3 border-t pt-6"><span className="text-xs text-muted-foreground">这条故事线暂告一段落</span><Button variant="outline" size="sm" onClick={() => select(chapter.parent ?? "arrival")}><ArrowLeft className="mr-1.5 size-3.5"/>返回上一章</Button></div>}
          </div>
        </div>
      </div>
       <aside className="soft-scroll hidden w-[244px] shrink-0 overflow-y-auto border-l bg-sidebar/35 px-4 py-6 xl:block" aria-label="章节素材"><p className="mb-5 text-[10px] font-semibold uppercase text-muted-foreground">本章素材</p><p className="mb-2 flex items-center gap-2 text-xs font-medium"><ImageIcon className="size-3.5 text-file-image"/>插图</p><img src={chapter.image} alt={chapter.imageCaption} width={1280} height={832} className="aspect-[4/3] w-full rounded-md border object-cover"/><p className="mt-2 text-[10px] text-muted-foreground">{chapter.imageCaption}</p><div className="my-6 border-t"/><p className="mb-3 flex items-center gap-2 text-xs font-medium"><Headphones className="size-3.5 text-file-media"/>配音</p><NarrationControls {...controls}/><p className="mt-3 text-[10px] leading-4 text-muted-foreground">浏览器语音合成示范，非录制音频；进度与时长为估算值</p></aside>
       <div className="fixed bottom-3 left-3 right-3 z-10 mx-auto max-w-[350px] rounded-md border bg-popover px-3 py-2 shadow-sm xl:hidden"><NarrationControls {...controls}/></div>
    </div>
  );
}
