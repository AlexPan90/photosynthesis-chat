# Photosynthesis Chat

你是一位资深 AI 产品设计师。请设计一套「Chat 前端对接 Agent」的 Web/桌面端对话界面。

产品定位：用户通过聊天界面与 AI Agent 交互，Agent 可调用工具、执行多步推理、返回富文本内容。界面需同时支持普通对话模式和 Agent 任务模式。参考产品：ChatGPT、Claude、DeepSeek 的交互范式，以及 Cherry Studio 的多模型管理布局和 browser-use web-ui 的浏览器 Agent 集成视图。

核心功能模块：

会话管理：左侧可折叠侧边栏，展示历史对话列表、新建会话、搜索、分组/标签。

消息流：居中对话线程，用户消息右对齐、Agent 消息左对齐；支持流式输出、打字指示器、Markdown 渲染、代码高亮、表格、图片。

Agent 状态可视化：当 Agent 调用工具（如浏览器操作、文件读写、搜索）时，以卡片或时间线形式展示执行步骤和状态（进行中 / 完成 / 失败）。

模型与 Agent 切换：顶部或输入区提供模型选择器（OpenAI / Anthropic / DeepSeek / 本地模型）和 Agent 切换入口。

输入区：支持多行输入、附件上传、快捷指令、发送/停止生成。

设置面板：API 配置、主题切换（亮/暗）、语言、字体大小、快捷键。

设计风格：极简、扁平、高信息密度但呼吸感充足。参考 Cherry Studio 的桌面端克制美学和 browser-use web-ui 的功能优先布局。中性色为主，强调色用于 Agent 状态和交互反馈。圆角柔和，边框极细，阴影层级轻。

交付：高保真界面稿（亮色 + 暗色），覆盖上述全部模块；标注关键交互状态（空状态、加载中、流式输出中、工具执行中、错误态）；提供组件级设计规范（间距、圆角、色彩、字体层级）。

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7a484cd1-30ff-418c-a069-ee41d878fe51).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
