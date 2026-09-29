# 编排中心：Agent 管理页 + MCP 连接页 + Skills 管理页（含远程仓库）

新增一个独立的「编排中心」页面（/studio/agents、/studio/mcp、/studio/skills 三个页签），侧栏底部加入口。对话里选中 Agent 时，自动带上它绑定的 MCP 工具和 Skills。

## 1. Agent 管理页（拖拽编排）
- 左侧：Agent 列表卡片，可拖拽调整顺序（顺序同步到输入框的模型菜单）。
- 右侧：选中 Agent 的编辑区——名称、职责、提示词、默认模型。
- 「能力库」面板：内置工具、已连接 MCP 的工具、已安装 Skills 三组，拖到 Agent 上即添加，卡片上的 × 移除；已添加的能力也能拖拽排序。
- 子 Agent：把另一个 Agent 拖进来，表示允许委派给它（沿用现有委派卡片展示执行过程）。
- 顶部「试运行」：在右侧小窗直接和这个 Agent 对话验证。

## 2. MCP 连接管理页
- 新建连接：填名称 + 地址，鉴权选「无 / API Key（请求头）/ OAuth」。预置常见服务（GitHub、Notion、Linear 等官方地址），选服务名自动填好。
- 保存时自动测试连接，列出它提供的工具；状态显示「已就绪 / 待授权 / 失败」，可重试、断开。
- 每个工具可单独开关，并标记「写操作需确认」（为后续人工批准预留）。
- 密钥和授权令牌只存在服务端，界面永远不回显。

## 3. Skills 管理页（支持远程仓库）
可以支持，做法类似 Skills Hub：
- 三种安装方式：
  1. 远程仓库：填 GitHub 仓库地址（如 anthropics/skills），自动扫描里面所有含 SKILL.md 的文件夹，列出来勾选安装。
  2. 订阅源：填一个索引地址（JSON 列表），像应用商店一样浏览、搜索、一键安装；预置一个官方示例源。
  3. 手动新建：在页面里直接写 SKILL.md。
- 安装后记录来源和版本，提供「检查更新 / 重新拉取」。
- 运行时渐进加载：系统提示只带名称和一句话描述，模型需要时调用 load_skill / read_skill_file 读取完整内容和参考资料（脚本执行暂不支持，只读）。

## 技术细节
- 新表（均按用户隔离 RLS + GRANT）：
  - agents 增加 sort_order、mcp_tool_ids text[]、skill_ids uuid[]、delegate_ids text[]
  - mcp_connections(name, url, auth_type, headers_enc, oauth_tokens_enc, state, tools jsonb, disabled_tools text[])
  - skills(name, description, source_type, source_url, ref, content, files jsonb, enabled)
- MCP 用 @ai-sdk/mcp 的 HTTP 传输，/api/chat 内按 Agent 绑定临时创建客户端、合并工具（名称加 `mcp_<连接>_` 前缀），流结束后关闭；OAuth 回调走 /api/public/mcp/callback。敏感字段服务端加密（新增 MCP_ENC_KEY 密钥，自动生成）。
- 远程仓库读取在服务端通过 GitHub 公共接口拉取目录树和 SKILL.md（未登录限额 60 次/小时，够用；后续可接 GitHub 连接提升限额）。
- 拖拽用 @dnd-kit（已在页签排序中使用的同类方案）。
- 分三步交付并逐一实测：Agent 编排页 → MCP 页（先无鉴权/API Key，再 OAuth）→ Skills 页。
