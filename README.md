# Replit2Api

> **Self-hosted AI proxy gateway · 自托管 AI 代理网关**
>
> One Replit project. All major AI providers. OpenAI-compatible API.
>
> 一个 Replit 项目，统一接入主流 AI 服务商，提供 OpenAI 兼容接口。

[![Version](https://img.shields.io/badge/version-1.0.1-6366f1?style=flat-square)](./version.json)
[![Replit](https://img.shields.io/badge/Replit-Remix%20%26%20Deploy-f26207?style=flat-square&logo=replit)](https://replit.com)
[![License](https://img.shields.io/badge/license-MIT-10b981?style=flat-square)](./LICENSE)

---

## 目录 · Table of Contents

- [简介 · Overview](#简介--overview)
- [功能特性 · Features](#功能特性--features)
- [快速开始 · Quick Start](#快速开始--quick-start)
- [API 端点 · Endpoints](#api-端点--endpoints)
- [认证方式 · Authentication](#认证方式--authentication)
- [模型路由 · Model Routing](#模型路由--model-routing)
- [工具调用 · Tool Calling](#工具调用--tool-calling)
- [扩展思考 · Extended Thinking](#扩展思考--extended-thinking)
- [客户端接入 · Client Integration](#客户端接入--client-integration)
- [Fleet Manager 多节点管理](#fleet-manager-多节点管理)
- [自动更新 · Auto Update](#自动更新--auto-update)
- [更新日志 · Changelog](#更新日志--changelog)

---

## 简介 · Overview

**中文**

Replit2Api 是一个运行在 Replit 上的 AI 代理网关。它将 OpenAI、Anthropic Claude、Google Gemini、OpenRouter 四大服务商统一暴露为单一的 OpenAI 兼容接口，让任何支持 OpenAI 格式的客户端（CherryStudio、SillyTavern、OpenWebUI 等）无需改动配置即可同时使用所有模型。

通过 Replit **Remix（混搭）** 功能一键部署，所有 API 密钥由 Replit Secrets 安全存储，支持热更新无需重新部署。

**English**

Replit2Api is an AI proxy gateway running on Replit. It unifies OpenAI, Anthropic Claude, Google Gemini, and OpenRouter behind a single OpenAI-compatible API endpoint, so any OpenAI-compatible client (CherryStudio, SillyTavern, OpenWebUI, etc.) can access all models without reconfiguration.

Deploy in one click via Replit **Remix**. All API keys are stored securely in Replit Secrets. Supports hot-update without redeployment.

---

## 功能特性 · Features

| 功能 | 说明 | Feature | Description |
|------|------|---------|-------------|
| 🔀 多后端路由 | 按模型名自动路由到对应服务商 | Multi-backend routing | Auto-routes by model name |
| 📐 格式自动转换 | 请求/响应在 OpenAI ↔ Claude ↔ Gemini 间自动互转 | Format conversion | Auto-converts between OpenAI / Claude / Gemini formats |
| 🔧 工具调用 | 完整支持 OpenAI tools + tool_calls，自动转换到各后端 | Tool calling | Full OpenAI tools/tool_calls, auto-converted per backend |
| 🧠 扩展思考 | `-thinking` / `-thinking-visible` 后缀别名，一键开启 | Extended thinking | `-thinking` / `-thinking-visible` suffix aliases |
| ⚡ 流式输出 | 所有端点均支持 SSE 流式，含 Claude 原生端点 | Streaming (SSE) | All endpoints support SSE streaming |
| 🔑 多种认证 | Bearer Token / x-goog-api-key / ?key= URL 参数 | Multi-auth | Bearer / x-goog-api-key / ?key= URL param |
| 🎭 SillyTavern 兼容 | 自动修复 Claude 角色顺序，追加空 user 消息 | SillyTavern compat | Auto-fixes Claude role ordering |
| 🖥️ 管理面板 | 三栏 Web UI：首页/统计节点/端点文档 | Admin panel | 3-tab Web UI: Home / Stats & Nodes / API Docs |
| 🛥️ Fleet Manager | 批量管理子节点版本检测与一键更新 | Fleet Manager | Batch version check & one-click update for sub-nodes |
| 📦 热更新 | 无需 GitHub，通过文件包跨实例推送更新 | Hot update | File-bundle push, no GitHub required |

---

## 快速开始 · Quick Start

### 方式一：Replit Remix（推荐）· Method 1: Replit Remix (Recommended)

**中文**

1. 访问已发布的实例页面，点击右上角 **Remix** 按钮
2. Replit 自动复制完整项目到你的账户
3. 在 **Secrets** 面板中配置以下环境变量：

**English**

1. Visit the published instance, click **Remix** in the top-right corner
2. Replit automatically copies the full project to your account
3. Configure the following environment variables in the **Secrets** panel:

```
PROXY_API_KEY      # 你的访问密码 / Your gateway password (required)
OPENAI_API_KEY     # OpenAI API Key（可选 / optional）
ANTHROPIC_API_KEY  # Anthropic API Key（可选 / optional）
GEMINI_API_KEY     # Google Gemini API Key（可选 / optional）
OPENROUTER_API_KEY # OpenRouter API Key（可选 / optional）
```

4. 点击 **Run** 启动，然后点击 **Publish** 发布到生产环境
4. Click **Run** to start, then **Publish** to go live

5. 将生产域名（`https://your-app.replit.app`）设为客户端的 **Base URL**
5. Set the production domain (`https://your-app.replit.app`) as the **Base URL** in your client

---

### 方式二：本地/手动部署 · Method 2: Manual Deploy

```bash
# 依赖 Node.js 18+ 和 pnpm
# Requires Node.js 18+ and pnpm

git clone https://github.com/your-username/Replit2Api.git
cd Replit2Api
pnpm install

# 复制并填写环境变量 / Copy and fill in env vars
cp .env.example .env

# 启动 API 服务 / Start API server
pnpm --filter @workspace/api-server run dev

# 启动前端面板 / Start frontend panel
pnpm --filter @workspace/api-portal run dev
```

---

## API 端点 · Endpoints

所有端点均需认证（见下节）。All endpoints require authentication (see below).

| 端点 | 方法 | 说明 | Endpoint | Method | Description |
|------|------|------|----------|--------|-------------|
| `/v1/chat/completions` | POST | OpenAI 聊天补全（主端点） | `/v1/chat/completions` | POST | OpenAI Chat Completions (main) |
| `/v1/models` | GET | 返回所有可用模型列表 | `/v1/models` | GET | List all available models |
| `/v1/messages` | POST | Anthropic Claude Messages 原生格式 | `/v1/messages` | POST | Anthropic Claude Messages native format |
| `/v1beta/models/{model}:generateContent` | POST | Gemini 原生格式 | `/v1beta/models/{model}:generateContent` | POST | Gemini native format |
| `/api/healthz` | GET | 健康检查 | `/api/healthz` | GET | Health check |
| `/api/update/version` | GET | 查询当前版本 | `/api/update/version` | GET | Query current version |
| `/api/update/apply` | POST | 触发热更新 | `/api/update/apply` | POST | Trigger hot update |

---

## 认证方式 · Authentication

支持三种方式，任选其一 / Three methods supported, pick any:

```bash
# 1. Bearer Token（推荐 / Recommended）
curl https://your-app.replit.app/v1/models \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"

# 2. x-api-key 请求头 / header
curl https://your-app.replit.app/v1/models \
  -H "x-api-key: YOUR_PROXY_API_KEY"

# 3. URL 查询参数 / Query param（Gemini 客户端常用）
curl "https://your-app.replit.app/v1/models?key=YOUR_PROXY_API_KEY"
```

---

## 模型路由 · Model Routing

路由规则按模型名称自动判断，无需手动切换。
Routing is automatic based on model name — no manual switching needed.

| 模型名前缀/特征 | 路由目标 | Model name prefix/pattern | Routes to |
|---------------|---------|--------------------------|-----------|
| `gpt-*`, `o1`, `o3`, `o4-*`, `text-*` | OpenAI | `gpt-*`, `o1`, `o3`, `o4-*` | OpenAI |
| `claude-*` | Anthropic | `claude-*` | Anthropic |
| `gemini-*` | Google Gemini | `gemini-*` | Google Gemini |
| `provider/model`（含 `/`） | OpenRouter | Any name containing `/` | OpenRouter |

### 扩展思考别名 · Extended Thinking Aliases

在任意支持思考的模型名后追加后缀即可：
Append a suffix to any thinking-capable model:

```
claude-opus-4-5-thinking           → 思考模式，隐藏过程 / thinking, hidden
claude-opus-4-5-thinking-visible   → 思考模式，展示过程 / thinking, visible
gemini-2.5-pro-thinking            → Gemini 思考模式 / Gemini thinking
```

---

## 工具调用 · Tool Calling

网关完整支持 OpenAI `tools` + `tool_calls` 格式，自动转换到各后端原生格式：
The gateway fully supports OpenAI `tools` + `tool_calls`, auto-converted per backend:

| 后端 / Backend | 转换规则 / Conversion |
|---------------|----------------------|
| **Anthropic** | `tools` → `input_schema`；`tool_choice: "required"` → `{type:"any"}`；`tool_calls` → `tool_use` blocks |
| **Gemini** | `tools` → `functionDeclarations`；`tool_calls` → `functionCall` parts |
| **OpenAI / OpenRouter** | 原样透传 / Pass-through |

流式工具调用完整支持 `input_json_delta` 逐块转发，`finish_reason` 正确映射为 `"tool_calls"`。
Streaming tool calls fully support `input_json_delta` chunk-by-chunk forwarding with correct `"tool_calls"` finish_reason.

```jsonc
// 示例请求 / Example request
{
  "model": "claude-opus-4-5",
  "tools": [{
    "type": "function",
    "function": {
      "name": "get_weather",
      "description": "Get current weather",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  }],
  "messages": [{ "role": "user", "content": "北京今天天气怎么样？" }]
}
```

---

## 扩展思考 · Extended Thinking

```jsonc
// 开启思考（隐藏过程）/ Enable thinking (hidden)
{ "model": "claude-opus-4-5-thinking", ... }

// 开启思考（展示过程）/ Enable thinking (visible)
{ "model": "claude-opus-4-5-thinking-visible", ... }

// 或直接在请求体中传参 / Or pass in body directly
{
  "model": "claude-opus-4-5",
  "thinking": { "type": "enabled", "budget_tokens": 8000 }
}
```

---

## 客户端接入 · Client Integration

### CherryStudio

1. 设置 → 模型服务商 → 添加服务商，类型选 **OpenAI Compatible**
2. Base URL 填入生产域名；API Key 填入 `PROXY_API_KEY`
3. 点击「检测」，自动加载全部模型

1. Settings → Model Providers → Add Provider → type: **OpenAI Compatible**
2. Base URL = your production domain; API Key = `PROXY_API_KEY`
3. Click "Check" — all models load automatically

### SillyTavern

1. 在管理面板首页开启 **SillyTavern 兼容模式**
2. API 类型选 **OpenAI**，Base URL 填入生产域名
3. 模型名直接填 `claude-opus-4-5` 等

1. Enable **SillyTavern Compatibility Mode** on the admin panel home tab
2. API type: **OpenAI**, Base URL = production domain
3. Model name: e.g. `claude-opus-4-5`

### OpenWebUI / LobeChat / 任意 OpenAI 兼容客户端

- Base URL: `https://your-app.replit.app`
- API Key: `YOUR_PROXY_API_KEY`
- 无需其他改动 / No other changes needed

---

## Fleet Manager 多节点管理

在管理面板 **统计 & 节点** 页可管理多个 Replit2Api 实例：
Manage multiple Replit2Api instances from the **Stats & Nodes** tab:

- **批量版本检测** — 一键查询所有子节点的当前版本号
- **一键更新** — 向子节点推送最新文件包，无需重新部署
- **导入/导出** — JSON 格式备份和恢复节点列表
- 节点数据存储在浏览器 localStorage，上游地址不暴露在 UI

- **Batch version check** — query all sub-node versions in one click
- **One-click update** — push the latest bundle to sub-nodes without redeployment
- **Import/Export** — backup and restore node list in JSON format
- Node data stored in browser localStorage; upstream URL never exposed in UI

---

## 自动更新 · Auto Update

Replit2Api 内置热更新机制，无需 GitHub：
Replit2Api has a built-in hot-update system, no GitHub required:

```
上游实例 (Upstream)              子节点 (Sub-node)
      │                               │
      ├── GET /api/update/version ────→ 版本号比对
      │                               │
      └── POST /api/update/apply ─────→ 下载文件包
                                       解压覆盖
                                       自动重启
```

在 Fleet Manager 中填入上游实例地址（即本项目的生产 URL）后，子节点可一键同步最新版本。
Add the upstream instance URL in Fleet Manager, and sub-nodes can sync the latest version in one click.

---

## 更新日志 · Changelog

### v1.0.1 — 2026-04-06

- 完整 tool calling 支持 — Claude、Gemini 自动格式互转
- Claude 流式工具调用：input_json_delta 逐块转发，finish_reason 正确映射为 tool_calls
- 前端三栏重构：首页 / 统计 & 节点 / 端点文档
- 新增 Fleet Manager — 子节点批量版本检测与一键更新

- Full tool calling support — auto-conversion for Claude (tool_use) and Gemini (functionDeclarations)
- Claude streaming tool calls with correct tool_calls finish_reason
- Frontend redesigned into 3-tab layout: Home / Stats & Nodes / API Docs
- New Fleet Manager — batch version check and one-click update for sub-nodes

### v1.0.0 — 2026-04-06

- 正式版发布 — 统一接入 OpenAI / Anthropic / Gemini / OpenRouter
- 支持 SillyTavern 兼容模式、CherryStudio 接入、多种认证方式
- Replit 文件包热更新机制（无需 GitHub，跨实例推送）

- Initial release — unified gateway for all major AI providers
- SillyTavern compatibility, CherryStudio integration, multiple auth methods
- Replit file-bundle hot-update system (no GitHub required)

---

## 许可证 · License

MIT License — 自由使用、修改、分发 / Free to use, modify, and distribute.

---

<div align="center">
  <sub>Powered by Replit · OpenAI · Anthropic · Google Gemini · OpenRouter</sub>
</div>
