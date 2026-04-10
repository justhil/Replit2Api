# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Replit2Api is a self-hosted AI proxy gateway running on Replit. It exposes an OpenAI-compatible API that routes requests to OpenAI, Anthropic Claude, Google Gemini, and OpenRouter. Supports multi-node fleet deployment with round-robin load balancing.

Current version tracked in `version.json`. Deployed on Replit with GCS-backed persistence.

## Build & Dev Commands

```bash
# Install (pnpm only, enforced by preinstall hook)
pnpm install

# Full build (typecheck + all artifacts)
pnpm build

# Typecheck only
pnpm typecheck

# Backend dev (builds + starts on PORT)
cd artifacts/api-server && pnpm dev

# Frontend dev (Vite dev server)
cd artifacts/api-portal && pnpm dev

# Backend build only
cd artifacts/api-server && pnpm build

# Frontend build only
cd artifacts/api-portal && pnpm build
```

No test suite exists. Validation relies on TypeScript type checking and manual testing via the admin panel.

## Architecture

**Monorepo** managed by pnpm workspaces (`artifacts/*`, `lib/*`).

### Backend (`artifacts/api-server`)

Express 5 app bundled with esbuild to a single `.mjs` file.

- **Entry**: `src/index.ts` → `src/app.ts` → routes
- **Route mounting**: Dual-mount — proxy routes available at both `/v1/*` and `/api/v1/*`
- **Core file**: `src/routes/proxy.ts` (~1500 lines) — contains ALL proxy logic: model registry, backend pool, health checking, format conversion, streaming, stats, admin endpoints
- **Persistence**: `src/lib/cloudPersist.ts` — GCS in production (`config/` prefix), local filesystem in dev (`data_dev/` dir). Persists: `dynamic_backends.json`, `disabled_models.json`, `routing_settings.json`, `usage_stats.json`
- **Logging**: pino + pino-http

### Frontend (`artifacts/api-portal`)

React 19 + Vite 7 + TailwindCSS 4 + shadcn/ui (Radix primitives).

- **Entry**: `src/main.tsx` → `src/App.tsx` (3-tab layout: Home / Stats & Nodes / API Docs)
- **Setup**: `src/components/SetupWizard.tsx` — interactive chat-style config wizard
- **Data fetching**: TanStack React Query
- **Routing**: wouter

## Key Design Decisions

### Model Routing

Model → provider mapping is determined by model ID prefix in `proxy.ts`:
- `gpt-*`, `o1`, `o3`, `o4-*` → OpenAI
- `claude-*` → Anthropic (with `-thinking` / `-thinking-visible` suffixes)
- `gemini-*` → Google Gemini (with thinking suffixes)
- Contains `/` → OpenRouter

All models are registered in constants at the top of `proxy.ts` (`OPENAI_CHAT_MODELS`, `ANTHROPIC_BASE_MODELS`, `GEMINI_BASE_MODELS`, `OPENROUTER_FEATURED`).

### Format Conversion

OpenAI chat format is the canonical interface. `proxy.ts` contains converters:
- `convertMessagesForClaude()` / `convertContentForClaude()` / `convertToolsForClaude()` — OpenAI → Anthropic format
- Gemini uses `@google/genai` SDK with its own conversion
- Image content (base64 and URL) handled in conversion
- Tool calling fully supported across providers

### Multi-Node Fleet

- Env vars: `FRIEND_PROXY_URL`, `FRIEND_PROXY_URL_2` … `FRIEND_PROXY_URL_20`
- Dynamic backends via `/v1/admin/backends` API (cloud-persisted)
- Health checks: 30s TTL, 15s timeout, background refresh every 30s
- Round-robin load balancing with auto-retry (up to 3 attempts for 5xx/network errors)
- Friend-first routing: local backend is fallback only (controlled by `routingSettings.localEnabled` / `localFallback`)

### Authentication

`requireApiKey` middleware accepts three forms:
- `Authorization: Bearer <PROXY_API_KEY>` (OpenAI-style)
- `x-api-key: <PROXY_API_KEY>` (Anthropic-style)
- `?key=<PROXY_API_KEY>` (Gemini compat, for `/v1/models` only)

### Stats Persistence

Per-backend stats (calls, errors, tokens, TTFT) in `statsMap`. Debounced save every 2s, safety-net persist every 60s, flush on SIGTERM/SIGINT.

## Environment Variables

**Required**: `PORT`, `PROXY_API_KEY`

**AI Integrations** (set via Replit Tools → Integrations):
- `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` + `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`
- `AI_INTEGRATIONS_GEMINI_API_KEY` + `AI_INTEGRATIONS_GEMINI_BASE_URL`
- `AI_INTEGRATIONS_OPENROUTER_API_KEY` + `AI_INTEGRATIONS_OPENROUTER_BASE_URL`

**Optional**: `DEFAULT_OBJECT_STORAGE_BUCKET_ID` (GCS persistence), `GITHUB_TOKEN` (update rate limits), `REPLIT_DEPLOYMENT` (prod/dev detection)

## Update System

Built-in self-update via `/api/update/apply` — pulls latest from GitHub (`Akatsuki03/Replit2Api`), rebuilds, and restarts via `process.exit(0)`. Version check endpoint at `/api/update/version`.

## SillyTavern Compatibility

Toggle at `/api/settings/sillytavern`. When enabled, appends an extra user message ("继续") for Claude models without tools to fix role ordering issues.
