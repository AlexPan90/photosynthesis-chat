<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — as it rewrites history on Lovable's side and the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Model configuration and chat records are user-owned; keep credentials encrypted server-side and enforce RLS so one user's data cannot leak to another.
- Keep `/chat/$threadId` URLs and `/studio/*` deep links; embed orchestra management in Settings so existing links and workflows survive.
- Use near-black/white surfaces with indigo accent and Sora/Manrope for the Monolithic Technical Glass direction; scale workspace text with shell-scale.
- Use AI Elements for transcript, tools and composer; preserve reusable Select, motion and icon-button compatibility so interaction patterns stay consistent.
- Agent orchestration stays in `/api/chat` with one stream for tool, prompt, model and delegate events so execution remains visible in conversation.
- Never execute scripts in the Worker runtime; use approved browser Web Worker or E2B sandbox because the Worker cannot spawn or eval.
