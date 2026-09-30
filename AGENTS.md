<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting published git history — force pushing, or rebasing/amending/squashing commits that are already pushed — as it rewrites history on Lovable's side and the user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Model CRUD is user-owned, not provider-catalog CRUD; gateway uses workspace key, direct models use encrypted credentials and per-model HTTPS endpoints; /models discovery is server-only with manual fallback, so keys stay private.
- Test OpenAI connections against its model directory before showing direct models; keep provider credentials encrypted and scoped to the owner so unverified keys cannot advertise availability.
- Use AI Elements for transcript, tools and composer; preserve reusable Select, motion and icon-button compatibility.
- Keep thread IDs in `/chat/$threadId`; sample story/reader state is client-side and narration uses browser speech synthesis, not recorded audio.
- Use near-black/white surfaces with indigo accent and Sora/Manrope per the Monolithic Technical Glass reference.
- Conversation is the focal pane; files open in a contextual resizable right pane. The chat shell uses 272px sidebar, 60px header, 860px message column and 300px contextual rail.
- Real chat streams through `/api/chat` via Lovable Gateway OpenAI Responses, default `openai/gpt-6-astra`; threads/messages are RLS user-owned, demo threads client-only.
- Agent orchestration stays in `/api/chat`; tools, prompt, model, delegates and streaming events share one UI message stream.
- Manage Agent/MCP/Skills under `/studio/*`; encrypt MCP secrets server-side and close per-request MCP clients after streaming.
- Skills load progressively via `load_skill`/`read_skill_file` (GitHub raw files read-only), keeping the system prompt brief.
- Execute scripts only in approved browser Web Worker or E2B sandbox; Worker runtime cannot spawn or eval.
- Persist paused delegate history in own-only `delegate_sessions`; resume via `delegate_action`, never trusting model-supplied args.
- Scale workspace text with shell-scale and preview each artifact by file type, avoiding misleading generic thumbnails.
