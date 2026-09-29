import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => { const r = s["redirect"]; return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? { redirect: r } : {}; },
  head: () => ({ meta: [
    { title: "登录 — Relay Studio" },
    { name: "description", content: "登录 Relay Studio，开始与 AI Agent 的真实对话。" },
    { property: "og:title", content: "登录 — Relay Studio" },
    { property: "og:description", content: "登录后即可保存对话并与 AI 实时交流。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    if (mode === "signin") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (err) { setError(err.message.includes("Invalid") ? "邮箱或密码不正确" : err.message); return; }
      navigate({ to: redirect ?? "/" });
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setBusy(false);
      if (err) { setError(err.message); return; }
      setSent(true);
    }
  }

  return <div className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
    <div className="w-full max-w-[360px]">
      <Link to="/" className="mb-10 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><span className="font-mono text-base font-semibold">R<span className="text-success">.</span></span></div>
        <span className="font-display text-[14px] font-semibold">relay<span className="text-primary">.</span><span className="ml-1 font-normal text-muted-foreground">studio</span></span>
      </Link>
      {sent ? <div>
        <h1 className="font-display text-xl font-semibold">查收确认邮件</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">我们向 {email} 发送了一封确认邮件，点击其中的链接即可完成注册。</p>
        <Button variant="link" className="mt-4 h-auto px-0 text-xs" onClick={() => { setSent(false); setMode("signin"); }}>返回登录</Button>
      </div> : <>
        <h1 className="font-display text-xl font-semibold">{mode === "signin" ? "登录" : "创建账号"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{mode === "signin" ? "登录后对话会自动保存到云端。" : "注册后即可开始真实的 AI 对话。"}</p>
        <form onSubmit={submit} className="mt-7 space-y-3">
          <Input type="email" required autoComplete="email" placeholder="邮箱" aria-label="邮箱" value={email} onChange={e => setEmail(e.target.value)} className="h-10" />
          <Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} placeholder="密码（至少 6 位）" aria-label="密码" value={password} onChange={e => setPassword(e.target.value)} className="h-10" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-10 w-full">{busy ? "请稍候…" : mode === "signin" ? "登录" : "注册"}</Button>
        </form>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {mode === "signin" ? "还没有账号？" : "已有账号？"}
          <button type="button" className="ml-1 font-medium text-foreground hover:underline" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}>{mode === "signin" ? "注册" : "登录"}</button>
        </p>
      </>}
    </div>
  </div>;
}
