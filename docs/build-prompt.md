# AI Proxy Gateway — Complete Build & Deployment Guide v6

> This document describes the full architecture and contains a copy-pasteable Replit Agent prompt to reproduce this project from scratch.

---

## Overview

A self-hosted OpenAI-compatible AI proxy running on Replit. Routes requests to four providers (OpenAI, Anthropic Claude, Google Gemini, OpenRouter) via Replit AI Integrations. Exposes a management portal and supports model-level enable/disable, SillyTavern compatibility, and cloud-persisted statistics.

---

## Architecture

```
pnpm monorepo
├── artifacts/
│   ├── api-server/        Express 5 + TypeScript — the proxy API
│   └── api-portal/        React 19 + Vite 7 + TailwindCSS 4 + shadcn/ui — management portal
├── lib/
│   ├── api-zod/           Shared Zod schemas
│   └── integrations-*/    Replit AI integration client wrappers
└── pnpm-workspace.yaml
```

Both artifacts bind to `$PORT` (assigned automatically by Replit per artifact).

---

## Environment Setup

### Secrets (Replit Secrets tab)

| Key | Purpose |
|---|---|
| `PROXY_API_KEY` | Shared auth key for all proxy clients |

### Replit AI Integrations (auto-provisioned via AGENTS.md)

Enable all four integrations in Replit. They inject:

| Key | Source |
|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit OpenAI integration |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit OpenAI integration |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit Anthropic integration |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | Replit Anthropic integration |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Replit Gemini integration |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Replit Gemini integration |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | Replit OpenRouter integration |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | Replit OpenRouter integration |

### Optional Environment Variables

| Key | Purpose |
|---|---|
| `FRIEND_PROXY_URL` … `FRIEND_PROXY_URL_20` | Friend proxy node base URLs |
| `VITE_BASE_URL` | Public URL shown in portal UI |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket for cloud persistence |
| `GITHUB_TOKEN` | GitHub API rate limit for update checks |

---

## API Server

### Stack
- Express 5 + TypeScript
- `openai` SDK (OpenAI + OpenRouter calls)
- `@anthropic-ai/sdk` (Claude calls)
- `@google/genai` SDK (Gemini calls)
- `pino` / `pino-http` (structured logging)
- `cors`, `express.json` (50 MB body limit)
- esbuild (bundle to single `.mjs`)

### Server setup (`src/app.ts`)

```typescript
app.use(pinoHttp({ logger }));
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/api", router);     // health check at /api/healthz, settings, update
app.use(proxyRouter);         // /v1/* routes
app.use("/api", proxyRouter); // dual-mount: /api/v1/* mirrors /v1/*
```

### Routes

#### `GET /api/healthz`
No auth. Returns `{ status: "ok" }`.

#### `GET /v1/models`
Auth required (also accepts `?key=` query param for Gemini compat). Returns OpenAI-format model list, filtered by enabled status.

#### `POST /v1/chat/completions`
Auth required. Main proxy route. OpenAI request body format. Routes by model provider:

- `gpt-*`, `o*` → OpenAI SDK (local integration)
- `claude-*` → Anthropic SDK (local integration)
- `gemini-*` → Google GenAI SDK (local integration)
- Contains `/` → OpenRouter via OpenAI SDK (local integration)

Streaming (`stream: true`) returns SSE. Non-streaming returns JSON.

#### `POST /v1/messages`
Auth required. **Anthropic-native endpoint** — accepts Anthropic message format directly, passes through to Claude SDK. Supports streaming (SSE with Anthropic event format) and non-streaming.

#### `GET /v1/stats`
Auth required. Per-backend + per-model statistics with uptimeSeconds.

#### `POST /v1/admin/stats/reset`
Auth required. Clears all accumulated stats.

#### `GET /v1/admin/models`
Auth required. Lists all models with provider and enabled status, plus per-provider summary.

#### `PATCH /v1/admin/models`
Auth required. Enable/disable models by `ids` array or `provider` string. Body: `{ ids?: string[], provider?: string, enabled: boolean }`.

#### `GET/POST /api/settings/sillytavern`
Get/toggle SillyTavern compatibility mode. When enabled, appends "继续" user message for Claude models without tools.

#### `GET /api/update/version`
Check for updates from GitHub.

#### `POST /api/update/apply`
Self-update: pulls latest from GitHub, rebuilds, restarts.

---

### Authentication Middleware

Accepts `PROXY_API_KEY` via:
1. `Authorization: Bearer <key>` — recommended
2. `x-api-key: <key>` — Anthropic-style
3. `?key=<key>` — URL query parameter (for `/v1/models` only)

---

### Routing Logic (`POST /v1/chat/completions`)

```
provider = MODEL_PROVIDER_MAP.get(model)

if provider === "anthropic":
    → Anthropic SDK via makeLocalAnthropic()
    → Strip -thinking / -thinking-visible suffix
    → Convert OpenAI messages → Anthropic format
    → Add thinking param if suffix was present

else if provider === "gemini":
    → Google GenAI SDK via makeLocalGemini()
    → Strip thinking suffixes
    → Convert to Gemini format

else if provider === "openrouter":
    → OpenAI SDK via makeLocalOpenRouter()
    → Pass through as OpenAI-compatible

else (openai):
    → OpenAI SDK via makeLocalOpenAI()
    → Pass through directly
```

All calls go through local integrations only. No friend proxy / round-robin in current architecture.

---

### Claude Handling

#### Suffix stripping
```typescript
const thinkingVisible = model.endsWith("-thinking-visible");
const thinkingEnabled  = thinkingVisible || model.endsWith("-thinking");
const actualModel = thinkingVisible
  ? model.replace(/-thinking-visible$/, "")
  : thinkingEnabled
    ? model.replace(/-thinking$/, "")
    : model;
```

#### Max tokens per model
```typescript
const CLAUDE_MODEL_MAX: Record<string, number> = {
  "claude-haiku-4-5":  8096,
  "claude-sonnet-4-5": 64000,
  "claude-sonnet-4-6": 64000,
  "claude-opus-4-1":   64000,
  "claude-opus-4-5":   64000,
  "claude-opus-4-6":   64000,
  // default fallback: 32000
};
// thinking enabled → max(modelMax, 32000)
```

#### Thinking parameter
```typescript
{ thinking: { type: "enabled", budget_tokens: 16000 } }
```

#### SSE streaming (Claude → OpenAI format)

| Anthropic event | OpenAI SSE chunk emitted |
|---|---|
| `message_start` | `{ delta: { role: "assistant", content: "" } }` |
| `content_block_start` (thinking) | `<thinking>\n` as content |
| `content_block_start` (text, after thinking) | `\n</thinking>\n\n` as content |
| `content_block_delta` thinking_delta | thinking text as content |
| `content_block_delta` text_delta | text as content (records TTFT) |
| `message_delta` | finish_reason + usage |

Keepalive: `: keepalive\n\n` every 5s via `setInterval`, cleared on `req.close`.

---

### Format Conversion (OpenAI ↔ Anthropic)

- `convertMessagesForClaude()` — OpenAI messages → Anthropic format (system extracted separately)
- `convertContentForClaude()` — image_url parts → Anthropic image blocks (base64 + URL)
- `convertToolsForClaude()` — OpenAI tool definitions → Anthropic input_schema format

Tool calling fully supported: assistant tool_calls → Anthropic tool_use blocks, tool role → tool_result.

---

### Model Registry

#### OpenAI (→ local OpenAI integration)
```
gpt-5.2, gpt-5.1, gpt-5, gpt-5-mini, gpt-5-nano
gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
gpt-4o, gpt-4o-mini
o4-mini, o3, o3-mini
(o-series get -thinking aliases)
```

#### Anthropic (→ local Anthropic integration)
```
claude-opus-4-6, claude-opus-4-5, claude-opus-4-1
claude-sonnet-4-6, claude-sonnet-4-5
claude-haiku-4-5
(each gets -thinking and -thinking-visible variants)
```

#### Gemini (→ local Gemini integration via @google/genai SDK)
```
gemini-3.1-pro-preview, gemini-3-flash-preview
gemini-2.5-pro, gemini-2.5-flash
(each gets -thinking and -thinking-visible variants)
```

#### OpenRouter (→ local OpenRouter integration via OpenAI SDK)
```
x-ai/grok-4.20, x-ai/grok-4.1-fast, x-ai/grok-4-fast
meta-llama/llama-4-maverick, meta-llama/llama-4-scout
deepseek/deepseek-v3.2, deepseek/deepseek-r1, deepseek/deepseek-r1-0528
mistralai/mistral-small-2603, qwen/qwen3.5-122b-a10b
google/gemini-2.5-pro, anthropic/claude-opus-4.6
cohere/command-a, amazon/nova-premier-v1, baidu/ernie-4.5-300b-a47b
```

---

### Persistence

Via `cloudPersist.ts` — GCS in production (`DEFAULT_OBJECT_STORAGE_BUCKET_ID`), local filesystem (`data_dev/`) in dev.

Persisted files:
- `dynamic_backends.json` — runtime-added friend backends
- `disabled_models.json` — model enable/disable state
- `routing_settings.json` — routing preferences
- `usage_stats.json` — per-backend and per-model statistics

Stats: debounced save every 2s, safety-net every 60s, flush on SIGTERM/SIGINT.

---

## Portal (`api-portal`)

### Stack
- React 19 + Vite 7
- TailwindCSS 4 + shadcn/ui (Radix primitives)
- wouter (routing)
- TanStack React Query
- lucide-react (icons)
- recharts (charts)

### Features
- Live status badge (polls `/api/healthz`)
- Model list with provider grouping and badges (tools / thinking / reasoning)
- Per-backend and per-model statistics dashboard
- SillyTavern compatibility toggle
- Self-update from GitHub
- API key persistence in localStorage

---

## Replit Agent Build Prompt

Copy and paste the following into Replit Agent to reproduce this project from scratch:

```
Build an OpenAI-compatible AI proxy gateway on Replit as a pnpm monorepo with two artifacts:
- artifacts/api-server  (Express 5 + TypeScript backend)
- artifacts/api-portal  (React 19 + Vite 7 + TailwindCSS 4 + shadcn/ui frontend)

━━━ SETUP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure all four Replit AI integrations. Execute sequentially:

setupReplitAIIntegrations({ providerSlug: "anthropic", providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY" })
setupReplitAIIntegrations({ providerSlug: "openai", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY" })
setupReplitAIIntegrations({ providerSlug: "gemini", providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY" })
setupReplitAIIntegrations({ providerSlug: "openrouter", providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL", providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY" })

Secret: PROXY_API_KEY (auth key for all clients).
Optional env: FRIEND_PROXY_URL … FRIEND_PROXY_URL_20, VITE_BASE_URL.

━━━ API SERVER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stack: Express 5, TypeScript, openai SDK, @anthropic-ai/sdk, @google/genai, pino-http, cors.
Bind to $PORT. Body limit 50 MB. Enable CORS globally.
Bundle with esbuild to single .mjs file.

── Auth middleware ──
Accept PROXY_API_KEY via: Authorization Bearer header, x-api-key header.
For /v1/models only: also accept ?key= query parameter.
Return 401 if missing/wrong.

── Route mounting ──
Dual-mount proxy routes: at root (/v1/*) and under /api (/api/v1/*).

── Routes ──
GET  /api/healthz                    → { status: "ok" } (no auth)
GET  /v1/models                      → OpenAI-format model list (filtered by enabled status)
POST /v1/chat/completions            → proxy to provider by model prefix, SSE streaming
POST /v1/messages                    → Anthropic-native endpoint, pass-through to Claude SDK
GET  /v1/stats                       → per-backend + per-model usage stats
POST /v1/admin/stats/reset           → clear all stats
GET  /v1/admin/models                → list models with enabled status + provider summary
PATCH /v1/admin/models               → enable/disable models by ids[] or provider
GET/POST /api/settings/sillytavern   → get/toggle SillyTavern compat mode
GET  /api/update/version             → check for updates from GitHub
POST /api/update/apply               → self-update from GitHub

── Routing inside POST /v1/chat/completions ──

Route by MODEL_PROVIDER_MAP lookup:

if provider === "anthropic":
    Anthropic SDK via makeLocalAnthropic()
    Strip -thinking / -thinking-visible suffix before calling
    Convert OpenAI messages → Anthropic format (system → separate param, images → Anthropic blocks)
    Convert tools → Anthropic input_schema format
    Max tokens: haiku-4-5=8096; sonnet/opus=64000; default=32000
    If thinking: add { thinking: { type: "enabled", budget_tokens: 16000 } }
    SSE: convert Anthropic events → OpenAI chunk format
    Keepalive: ": keepalive\n\n" every 5s

else if provider === "gemini":
    Google GenAI SDK via makeLocalGemini()
    Strip thinking suffixes
    Convert to Gemini format

else if provider === "openrouter":
    OpenAI SDK via makeLocalOpenRouter() (different baseURL + apiKey)
    Pass through as OpenAI-compatible

else (openai):
    OpenAI SDK via makeLocalOpenAI()
    Pass through directly, stream_options: { include_usage: true }

── Stats ──
Per backend label: calls, errors, promptTokens, completionTokens, totalDurationMs, totalTtftMs, streamingCalls
Per model: calls, promptTokens, completionTokens
Persisted via cloudPersist (GCS in prod, local filesystem in dev)
Debounced save 2s, safety-net 60s, flush on SIGTERM/SIGINT

── Model enable/disable ──
Persisted to disabled_models.json via cloudPersist
PATCH /v1/admin/models: accept { ids: string[], enabled: boolean } or { provider: string, enabled: boolean }

── SillyTavern compat ──
When enabled + Claude model + no tools → append { role: "user", content: "继续" } to messages

── Model list ──
OpenAI: gpt-5.2, gpt-5.1, gpt-5, gpt-5-mini, gpt-5-nano,
        gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, gpt-4o, gpt-4o-mini,
        o4-mini, o3, o3-mini
        (o-series get -thinking aliases)

Anthropic: claude-opus-4-6, claude-opus-4-5, claude-opus-4-1,
           claude-sonnet-4-6, claude-sonnet-4-5, claude-haiku-4-5
           (each gets -thinking and -thinking-visible variants)

Gemini: gemini-3.1-pro-preview, gemini-3-flash-preview,
        gemini-2.5-pro, gemini-2.5-flash
        (each gets -thinking and -thinking-visible variants)

OpenRouter: x-ai/grok-4.20, x-ai/grok-4.1-fast, x-ai/grok-4-fast,
            meta-llama/llama-4-maverick, meta-llama/llama-4-scout,
            deepseek/deepseek-v3.2, deepseek/deepseek-r1, deepseek/deepseek-r1-0528,
            mistralai/mistral-small-2603, qwen/qwen3.5-122b-a10b,
            google/gemini-2.5-pro, anthropic/claude-opus-4.6,
            cohere/command-a, amazon/nova-premier-v1, baidu/ernie-4.5-300b-a47b

━━━ API PORTAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stack: React 19, Vite 7, TailwindCSS 4, shadcn/ui (Radix primitives), wouter, TanStack React Query.
Bind to $PORT. Use lucide-react for icons, recharts for charts.

Features:
- Live status badge (polls /api/healthz)
- Model list grouped by provider with badges (tools / thinking / reasoning)
- Per-backend and per-model stats dashboard (polls /v1/stats every 15s)
- SillyTavern compatibility toggle
- Self-update notification from GitHub
- API key persistence in localStorage
```

---

## Client Usage

### SillyTavern
- Connection type: **OpenAI**
- Base URL: `https://your-app.replit.app`
- API Key: your `PROXY_API_KEY`

### CherryStudio / any OpenAI-compatible client
- API Base URL: `https://your-app.replit.app/v1`
- API Key: your `PROXY_API_KEY`

### Anthropic-native clients
- API Base URL: `https://your-app.replit.app`
- Use `POST /v1/messages` endpoint directly with Anthropic message format

### curl — Chat
```bash
curl https://your-app.replit.app/v1/chat/completions \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.2","messages":[{"role":"user","content":"Hello"}]}'
```

### curl — List models
```bash
curl https://your-app.replit.app/v1/models \
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"
```

---

## Changelog

| Version | Change |
|---|---|
| v1 | Initial build: round-robin, health check, Claude thinking, dynamic backends |
| v2 | Expanded model list (GPT-5 series, Claude opus/sonnet 4-x, Gemini, OpenRouter) |
| v3 | New portal UI (inline styles, model registry with badges, SillyTavern guide) |
| v4 | `VITE_BASE_URL` env var so portal always shows correct deployed address |
| v5 | Friend proxy handler switched to raw `fetch` + manual SSE parsing to fix token tracking |
| v6 | Architecture simplification: removed fleet/round-robin, added Gemini+OpenRouter local integrations, Express 5, React 19 + TailwindCSS + shadcn/ui, Anthropic-native `/v1/messages` endpoint, model enable/disable, cloud persistence |
