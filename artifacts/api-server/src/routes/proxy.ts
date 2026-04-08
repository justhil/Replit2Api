import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { readJson, writeJson } from "../lib/cloudPersist";
import { getSillyTavernMode } from "./settings";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

const OPENAI_CHAT_MODELS = [
  "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-5-nano",
  "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
  "gpt-4o", "gpt-4o-mini",
  "o4-mini", "o3", "o3-mini",
];
const OPENAI_THINKING_ALIASES = OPENAI_CHAT_MODELS
  .filter((m) => m.startsWith("o"))
  .map((m) => `${m}-thinking`);

const ANTHROPIC_BASE_MODELS = [
  "claude-opus-4-6", "claude-opus-4-5", "claude-opus-4-1",
  "claude-sonnet-4-6", "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

const GEMINI_BASE_MODELS = [
  "gemini-3.1-pro-preview", "gemini-3-flash-preview",
  "gemini-2.5-pro", "gemini-2.5-flash",
];

const OPENROUTER_FEATURED = [
  "x-ai/grok-4.20", "x-ai/grok-4.1-fast", "x-ai/grok-4-fast",
  "meta-llama/llama-4-maverick", "meta-llama/llama-4-scout",
  "deepseek/deepseek-v3.2", "deepseek/deepseek-r1", "deepseek/deepseek-r1-0528",
  "mistralai/mistral-small-2603", "qwen/qwen3.5-122b-a10b",
  "google/gemini-2.5-pro", "anthropic/claude-opus-4.6",
  "cohere/command-a", "amazon/nova-premier-v1", "baidu/ernie-4.5-300b-a47b",
];

const OPENAI_MODELS = OPENAI_CHAT_MODELS.map((id) => ({ id, description: "OpenAI model" }));
const CLAUDE_MODELS = ANTHROPIC_BASE_MODELS.flatMap((id) => [
  { id, description: "Anthropic Claude model" },
  { id: `${id}-thinking`, description: "Extended thinking (hidden)" },
  { id: `${id}-thinking-visible`, description: "Extended thinking (visible)" },
]);

const ALL_MODELS = [
  ...OPENAI_CHAT_MODELS.map((id) => ({ id })),
  ...OPENAI_THINKING_ALIASES.map((id) => ({ id })),
  ...ANTHROPIC_BASE_MODELS.flatMap((id) => [
    { id },
    { id: `${id}-thinking` },
    { id: `${id}-thinking-visible` },
  ]),
  ...GEMINI_BASE_MODELS.flatMap((id) => [
    { id }, { id: `${id}-thinking` }, { id: `${id}-thinking-visible` },
  ]),
  ...OPENROUTER_FEATURED.map((id) => ({ id })),
];

// ---------------------------------------------------------------------------
// Backend pool — round-robin across local account + multiple friend proxies
// with background health checking
// ---------------------------------------------------------------------------

type Backend =
  | { kind: "local" }
  | { kind: "friend"; label: string; url: string; apiKey: string };

interface HealthEntry { healthy: boolean; checkedAt: number }
const healthCache = new Map<string, HealthEntry>();
const HEALTH_TTL_MS = 30_000;   // reuse cached result for 30s
const HEALTH_TIMEOUT_MS = 15_000; // 15s timeout per check (Replit cold starts can take 10–30s)

// ---------------------------------------------------------------------------
// Dynamic backends (cloud-persisted via GCS in production, local file in dev)
// ---------------------------------------------------------------------------

interface DynamicBackend { label: string; url: string; enabled?: boolean }

let dynamicBackends: DynamicBackend[] = [];

// Async bootstrap — load persisted data from GCS (or local file) on startup
(async () => {
  const saved = await readJson<DynamicBackend[]>("dynamic_backends.json");
  if (Array.isArray(saved)) dynamicBackends = saved;
})();

function saveDynamicBackends(list: DynamicBackend[]): void {
  writeJson("dynamic_backends.json", list).catch(() => {});
}

// ---------------------------------------------------------------------------
// Model provider map + enable/disable management
// ---------------------------------------------------------------------------

type ModelProvider = "openai" | "anthropic" | "gemini" | "openrouter";

// Build a complete id → provider lookup from the model constants above
const MODEL_PROVIDER_MAP = new Map<string, ModelProvider>();

for (const id of OPENAI_CHAT_MODELS) { MODEL_PROVIDER_MAP.set(id, "openai"); }
for (const id of OPENAI_THINKING_ALIASES) { MODEL_PROVIDER_MAP.set(id, "openai"); }
for (const base of ANTHROPIC_BASE_MODELS) {
  MODEL_PROVIDER_MAP.set(base, "anthropic");
  MODEL_PROVIDER_MAP.set(`${base}-thinking`, "anthropic");
  MODEL_PROVIDER_MAP.set(`${base}-thinking-visible`, "anthropic");
}
for (const base of GEMINI_BASE_MODELS) {
  MODEL_PROVIDER_MAP.set(base, "gemini");
  MODEL_PROVIDER_MAP.set(`${base}-thinking`, "gemini");
  MODEL_PROVIDER_MAP.set(`${base}-thinking-visible`, "gemini");
}
for (const id of OPENROUTER_FEATURED) { MODEL_PROVIDER_MAP.set(id, "openrouter"); }

let disabledModels: Set<string> = new Set<string>();

// Async bootstrap for disabled models
(async () => {
  const saved = await readJson<string[]>("disabled_models.json");
  if (Array.isArray(saved)) disabledModels = new Set<string>(saved);
})();

function saveDisabledModels(set: Set<string>): void {
  writeJson("disabled_models.json", [...set]).catch(() => {});
}

interface RoutingSettings { localEnabled: boolean; localFallback: boolean; fakeStream: boolean }
let routingSettings: RoutingSettings = { localEnabled: true, localFallback: true, fakeStream: true };

(async () => {
  const saved = await readJson<Partial<RoutingSettings>>("routing_settings.json");
  if (saved && typeof saved === "object") {
    if (typeof saved.localEnabled === "boolean") routingSettings.localEnabled = saved.localEnabled;
    if (typeof saved.localFallback === "boolean") routingSettings.localFallback = saved.localFallback;
    if (typeof saved.fakeStream === "boolean") routingSettings.fakeStream = saved.fakeStream;
  }
})();

function saveRoutingSettings(): void {
  writeJson("routing_settings.json", routingSettings).catch(() => {});
}

function isModelEnabled(id: string): boolean {
  return !disabledModels.has(id);
}

// Normalize sub-node endpoint URL — ensures it ends with /api.
// Sub-nodes use the same dual-mount architecture: /api/v1/* routes.
function normalizeSubNodeUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (!url) return url;
  return /\/api$/i.test(url) ? url : url + "/api";
}

function getFriendProxyConfigs(): { label: string; url: string; apiKey: string }[] {
  const apiKey = process.env.PROXY_API_KEY ?? "";
  const configs: { label: string; url: string; apiKey: string }[] = [];

  // Auto-scan FRIEND_PROXY_URL, FRIEND_PROXY_URL_2 … FRIEND_PROXY_URL_20 from env
  const envKeys = ["FRIEND_PROXY_URL", ...Array.from({ length: 19 }, (_, i) => `FRIEND_PROXY_URL_${i + 2}`)];
  for (const key of envKeys) {
    const raw = process.env[key];
    if (raw) configs.push({ label: key.replace("FRIEND_PROXY_URL", "FRIEND"), url: normalizeSubNodeUrl(raw), apiKey });
  }

  // Merge dynamic backends (added via API), skip duplicates and disabled ones
  const knownUrls = new Set(configs.map((c) => c.url));
  for (const d of dynamicBackends) {
    const url = normalizeSubNodeUrl(d.url);
    if (!knownUrls.has(url) && d.enabled !== false) configs.push({ label: d.label, url, apiKey });
  }

  return configs;
}

// getAllFriendProxyConfigs — 返回全部节点（含禁用的），专供统计页面使用
function getAllFriendProxyConfigs(): { label: string; url: string; apiKey: string; enabled: boolean }[] {
  const apiKey = process.env.PROXY_API_KEY ?? "";
  const configs: { label: string; url: string; apiKey: string; enabled: boolean }[] = [];

  const envKeys = ["FRIEND_PROXY_URL", ...Array.from({ length: 19 }, (_, i) => `FRIEND_PROXY_URL_${i + 2}`)];
  for (const key of envKeys) {
    const raw = process.env[key];
    if (raw) configs.push({ label: key.replace("FRIEND_PROXY_URL", "FRIEND"), url: normalizeSubNodeUrl(raw), apiKey, enabled: true });
  }

  const knownUrls = new Set(configs.map((c) => c.url));
  for (const d of dynamicBackends) {
    const url = normalizeSubNodeUrl(d.url);
    if (!knownUrls.has(url)) configs.push({ label: d.label, url, apiKey, enabled: d.enabled !== false });
  }

  return configs;
}

async function probeHealth(url: string, apiKey: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const resp = await fetch(`${url}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}

function getCachedHealth(url: string): boolean | null {
  const entry = healthCache.get(url);
  if (!entry) return null; // unknown — never checked
  if (Date.now() - entry.checkedAt < HEALTH_TTL_MS) return entry.healthy;
  return null; // stale
}

function setHealth(url: string, healthy: boolean): void {
  healthCache.set(url, { healthy, checkedAt: Date.now() });
}

// Refresh stale/unknown health entries in the background (non-blocking)
function refreshHealthAsync(): void {
  const configs = getFriendProxyConfigs();
  for (const { url, apiKey } of configs) {
    if (getCachedHealth(url) === null) {
      probeHealth(url, apiKey).then((ok) => setHealth(url, ok)).catch(() => setHealth(url, false));
    }
  }
}

// Kick off initial health checks after a short delay (server hasn't fully started yet)
setTimeout(refreshHealthAsync, 2000);
// Recheck every 30s
setInterval(refreshHealthAsync, HEALTH_TTL_MS);

function buildBackendPool(): Backend[] {
  const friends: Backend[] = [];

  for (const { label, url, apiKey } of getFriendProxyConfigs()) {
    const healthy = getCachedHealth(url);
    if (healthy !== false) {
      friends.push({ kind: "friend", label, url, apiKey });
    }
  }

  if (friends.length > 0) return friends;

  if (routingSettings.localFallback && routingSettings.localEnabled) return [{ kind: "local" }];

  return [];
}

let requestCounter = 0;

function pickBackend(): Backend | null {
  const pool = buildBackendPool();
  if (pool.length === 0) return null;
  const backend = pool[requestCounter % pool.length];
  requestCounter++;
  return backend;
}

function pickBackendExcluding(exclude: Set<string>): Backend | null {
  const friends = buildBackendPool().filter(
    (b) => b.kind === "friend" && !exclude.has(b.url)
  );
  if (friends.length > 0) return friends[requestCounter % friends.length];
  if (routingSettings.localFallback && routingSettings.localEnabled) return { kind: "local" };
  return null;
}

// ---------------------------------------------------------------------------
// Client factories
// ---------------------------------------------------------------------------

function makeLocalOpenAI(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "OpenAI integration is not configured. Please add the OpenAI integration in Replit (Tools → Integrations) to use GPT models."
    );
  }
  return new OpenAI({ apiKey, baseURL });
}

function makeLocalAnthropic(): Anthropic {
  const apiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "Anthropic integration is not configured. Please add the Anthropic integration in Replit (Tools → Integrations) to use Claude models."
    );
  }
  return new Anthropic({ apiKey, baseURL });
}

function makeLocalGemini(): GoogleGenAI {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (!apiKey || !baseUrl) {
    throw new Error(
      "Gemini integration is not configured. Please add the Gemini integration in Replit (Tools → Integrations) to use Gemini models."
    );
  }
  return new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "", baseUrl } });
}

function makeLocalOpenRouter(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  if (!apiKey || !baseURL) {
    throw new Error(
      "OpenRouter integration is not configured. Please add the OpenRouter integration in Replit (Tools → Integrations) to use OpenRouter models."
    );
  }
  return new OpenAI({ apiKey, baseURL });
}


// ---------------------------------------------------------------------------
// Per-backend usage statistics — persisted to cloudPersist ("usage_stats.json")
// ---------------------------------------------------------------------------

const STATS_FILE = "usage_stats.json";

interface BackendStat {
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalDurationMs: number;
  totalTtftMs: number;
  streamingCalls: number;
}

const EMPTY_STAT = (): BackendStat => ({
  calls: 0, errors: 0, promptTokens: 0, completionTokens: 0,
  totalDurationMs: 0, totalTtftMs: 0, streamingCalls: 0,
});

const statsMap = new Map<string, BackendStat>();

// ── Persistence helpers ────────────────────────────────────────────────────

function statsToObject(): Record<string, BackendStat> {
  return Object.fromEntries(statsMap.entries());
}

async function persistStats(): Promise<void> {
  try { await writeJson(STATS_FILE, statsToObject()); } catch {}
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { _saveTimer = null; void persistStats(); }, 2_000);
}

setInterval(() => { void persistStats(); }, 60_000);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    console.log(`[stats] ${sig} received, flushing stats…`);
    persistStats().finally(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000);
  });
}

// Load persisted stats at startup.
(async () => {
  try {
    const saved = await readJson<Record<string, BackendStat>>(STATS_FILE);
    if (saved && typeof saved === "object") {
      for (const [label, raw] of Object.entries(saved)) {
        if (raw && typeof raw === "object") {
          statsMap.set(label, {
            calls:            Number(raw.calls)            || 0,
            errors:           Number(raw.errors)           || 0,
            promptTokens:     Number(raw.promptTokens)     || 0,
            completionTokens: Number(raw.completionTokens) || 0,
            totalDurationMs:  Number(raw.totalDurationMs)  || 0,
            totalTtftMs:      Number(raw.totalTtftMs)      || 0,
            streamingCalls:   Number(raw.streamingCalls)   || 0,
          });
        }
      }
      console.log(`[stats] loaded ${statsMap.size} backend(s) from ${STATS_FILE}`);
    }
  } catch {
    console.warn(`[stats] could not load ${STATS_FILE}, starting fresh`);
  }
})();

// ── Stat accessors ─────────────────────────────────────────────────────────

function getStat(label: string): BackendStat {
  if (!statsMap.has(label)) statsMap.set(label, EMPTY_STAT());
  return statsMap.get(label)!;
}

function recordCallStat(label: string, durationMs: number, prompt: number, completion: number, ttftMs?: number): void {
  const s = getStat(label);
  s.calls++;
  s.promptTokens += prompt;
  s.completionTokens += completion;
  s.totalDurationMs += durationMs;
  if (ttftMs !== undefined) { s.totalTtftMs += ttftMs; s.streamingCalls++; }
  scheduleSave();
}

function recordErrorStat(label: string): void { getStat(label).errors++; scheduleSave(); }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setSseHeaders(res: Response) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();
}

function writeAndFlush(res: Response, data: string) {
  res.write(data);
  (res as unknown as { flush?: () => void }).flush?.();
}

async function fakeStreamResponse(
  res: Response,
  json: Record<string, unknown>,
  startTime: number,
): Promise<{ promptTokens: number; completionTokens: number; ttftMs: number }> {
  const id = (json["id"] as string) ?? `chatcmpl-fake-${Date.now()}`;
  const model = (json["model"] as string) ?? "unknown";
  const created = (json["created"] as number) ?? Math.floor(Date.now() / 1000);
  const choices = (json["choices"] as Array<Record<string, unknown>>) ?? [];
  const usage = json["usage"] as { prompt_tokens?: number; completion_tokens?: number } | undefined;

  setSseHeaders(res);

  const roleChunk = {
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
  };
  writeAndFlush(res, `data: ${JSON.stringify(roleChunk)}\n\n`);
  const ttftMs = Date.now() - startTime;

  const fullContent = (choices[0]?.["message"] as { content?: string })?.content ?? "";
  const toolCalls = (choices[0]?.["message"] as { tool_calls?: unknown[] })?.tool_calls;

  if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
    const tcChunk = {
      id, object: "chat.completion.chunk", created, model,
      choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: null }],
    };
    writeAndFlush(res, `data: ${JSON.stringify(tcChunk)}\n\n`);
  }

  const CHUNK_SIZE = 4;
  for (let i = 0; i < fullContent.length; i += CHUNK_SIZE) {
    const slice = fullContent.slice(i, i + CHUNK_SIZE);
    const chunk = {
      id, object: "chat.completion.chunk", created, model,
      choices: [{ index: 0, delta: { content: slice }, finish_reason: null }],
    };
    writeAndFlush(res, `data: ${JSON.stringify(chunk)}\n\n`);
    if (i + CHUNK_SIZE < fullContent.length) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  const finishReason = (choices[0]?.["finish_reason"] as string) ?? "stop";
  const stopChunk = {
    id, object: "chat.completion.chunk", created, model,
    choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
    ...(usage ? { usage } : {}),
  };
  writeAndFlush(res, `data: ${JSON.stringify(stopChunk)}\n\n`);
  writeAndFlush(res, "data: [DONE]\n\n");
  res.end();

  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
    ttftMs,
  };
}

function requireApiKey(req: Request, res: Response, next: () => void) {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) {
    res.status(500).json({ error: { message: "Server API key not configured", type: "server_error" } });
    return;
  }

  // Accept: Authorization: Bearer <key>  (OpenAI-style)
  //         x-api-key: <key>             (Anthropic-style)
  const authHeader = req.headers["authorization"];
  const xApiKey = req.headers["x-api-key"];

  let providedKey: string | undefined;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    providedKey = authHeader.slice(7);
  } else if (typeof xApiKey === "string") {
    providedKey = xApiKey;
  }

  if (!providedKey) {
    res.status(401).json({ error: { message: "Missing API key (provide Authorization: Bearer <key> or x-api-key header)", type: "invalid_request_error" } });
    return;
  }
  if (providedKey !== proxyKey) {
    res.status(401).json({ error: { message: "Invalid API key", type: "invalid_request_error" } });
    return;
  }
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/v1/models", requireApiKey, (_req: Request, res: Response) => {
  const pool = buildBackendPool();
  const friendStatuses = getFriendProxyConfigs().map(({ label, url }) => ({
    label,
    url,
    status: getCachedHealth(url) === null ? "unknown" : getCachedHealth(url) ? "healthy" : "down",
  }));
  res.json({
    object: "list",
    data: ALL_MODELS.filter((m) => isModelEnabled(m.id)).map((m) => ({
      id: m.id,
      object: "model",
      created: 1700000000,
      owned_by: "replit-proxy",
      description: m.description,
    })),
    _meta: {
      active_backends: pool.length,
      local: "healthy",
      friends: friendStatuses,
    },
  });
});

// ---------------------------------------------------------------------------
// Image format conversion: OpenAI image_url → Anthropic image
// ---------------------------------------------------------------------------

type OAIContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: string } }
  | Record<string, unknown>;

type OAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

type OAITool = {
  type: "function";
  function: { name: string; description?: string; parameters?: unknown };
};

type OAIMessage =
  | { role: "system"; content: string | OAIContentPart[] }
  | { role: "user"; content: string | OAIContentPart[] }
  | { role: "assistant"; content: string | OAIContentPart[] | null; tool_calls?: OAIToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string }
  | { role: string; content: string | OAIContentPart[] | null };

type AnthropicImageSource =
  | { type: "base64"; media_type: string; data: string }
  | { type: "url"; url: string };

type AnthropicContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: AnthropicImageSource }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | AnthropicContentPart[] };

function convertContentForClaude(content: string | OAIContentPart[] | null | undefined): string | AnthropicContentPart[] {
  if (!content) return "";
  if (typeof content === "string") return content;

  return content.map((part): AnthropicContentPart => {
    if (part.type === "image_url") {
      const url = (part as { type: "image_url"; image_url: { url: string } }).image_url.url;
      if (url.startsWith("data:")) {
        const [header, data] = url.split(",");
        const media_type = header.replace("data:", "").replace(";base64", "");
        return { type: "image", source: { type: "base64", media_type, data } };
      } else {
        return { type: "image", source: { type: "url", url } };
      }
    }
    if (part.type === "text") {
      return { type: "text", text: (part as { type: "text"; text: string }).text };
    }
    return { type: "text", text: JSON.stringify(part) };
  });
}

// Convert OpenAI tools array → Anthropic tools array
function convertToolsForClaude(tools: OAITool[]): { name: string; description: string; input_schema: unknown }[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description ?? "",
    input_schema: t.function.parameters ?? { type: "object", properties: {} },
  }));
}

// Convert OpenAI messages (incl. tool_calls / tool roles) → Anthropic messages
function convertMessagesForClaude(messages: OAIMessage[]): AnthropicMessage[] {
  const result: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // handled as top-level system param

    if (msg.role === "assistant") {
      const assistantMsg = msg as Extract<OAIMessage, { role: "assistant" }>;
      if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
        // Convert tool_calls to Anthropic tool_use blocks
        const parts: AnthropicContentPart[] = [];
        const textContent = assistantMsg.content;
        if (textContent && (typeof textContent === "string" ? textContent.trim() : textContent.length > 0)) {
          const converted = convertContentForClaude(textContent as string | OAIContentPart[]);
          if (typeof converted === "string") {
            if (converted.trim()) parts.push({ type: "text", text: converted });
          } else {
            parts.push(...converted);
          }
        }
        for (const tc of assistantMsg.tool_calls) {
          let input: unknown = {};
          try { input = JSON.parse(tc.function.arguments); } catch {}
          parts.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
        }
        result.push({ role: "assistant", content: parts });
      } else {
        result.push({
          role: "assistant",
          content: convertContentForClaude(assistantMsg.content as string | OAIContentPart[]),
        });
      }
    } else if (msg.role === "tool") {
      // Tool results → Anthropic user message with tool_result
      const toolMsg = msg as Extract<OAIMessage, { role: "tool" }>;
      result.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolMsg.tool_call_id, content: toolMsg.content }],
      });
    } else {
      // user (and any other role)
      result.push({
        role: "user",
        content: convertContentForClaude(msg.content as string | OAIContentPart[]),
      });
    }
  }

  return result;
}

router.post("/v1/chat/completions", requireApiKey, async (req: Request, res: Response) => {
  const { model, messages, stream, max_tokens, tools, tool_choice } = req.body as {
    model?: string;
    messages: OAIMessage[];
    stream?: boolean;
    max_tokens?: number;
    tools?: OAITool[];
    tool_choice?: unknown;
  };

  // Reject disabled models early
  if (model && !isModelEnabled(model)) {
    res.status(403).json({ error: { message: `Model '${model}' is disabled on this gateway`, type: "invalid_request_error", code: "model_disabled" } });
    return;
  }

  const selectedModel = model && ALL_MODELS.some((m) => m.id === model) ? model : "gpt-5.2";
  const provider = MODEL_PROVIDER_MAP.get(selectedModel) ?? "openai";
  const isClaudeModel = provider === "anthropic";
  const isGeminiModel = provider === "gemini";
  const isOpenRouterModel = provider === "openrouter";
  const shouldStream = stream ?? false;
  const startTime = Date.now();

  const finalMessages = (isClaudeModel && getSillyTavernMode() && !tools?.length)
    ? [...messages, { role: "user" as const, content: "继续" }]
    : messages;

  const MAX_FRIEND_RETRIES = 3;
  const triedFriendUrls = new Set<string>();
  let backend = pickBackend();
  if (!backend) { res.status(503).json({ error: { message: "No available backends — all sub-nodes are down and local fallback is disabled", type: "service_unavailable" } }); return; }

  for (let attempt = 0; ; attempt++) {
    const backendLabel = backend.kind === "local" ? "local" : backend.label;
    req.log.info({ model: selectedModel, backend: backendLabel, attempt, counter: requestCounter - 1, sillyTavern: isClaudeModel && getSillyTavernMode(), toolCount: tools?.length ?? 0 }, "Proxy request");

    try {
      let result: { promptTokens: number; completionTokens: number; ttftMs?: number };
      if (backend.kind === "friend") {
        triedFriendUrls.add(backend.url);
        result = await handleFriendProxy({ req, res, backend, model: selectedModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens, tools, toolChoice: tool_choice, startTime });
      } else if (isClaudeModel) {
        const thinkingVisible = selectedModel.endsWith("-thinking-visible");
        const thinkingEnabled = thinkingVisible || selectedModel.endsWith("-thinking");
        const actualModel = thinkingVisible
          ? selectedModel.replace(/-thinking-visible$/, "")
          : thinkingEnabled
            ? selectedModel.replace(/-thinking$/, "")
            : selectedModel;
        const CLAUDE_MODEL_MAX: Record<string, number> = {
          "claude-haiku-4-5": 8096,
          "claude-sonnet-4-5": 64000,
          "claude-sonnet-4-6": 64000,
          "claude-opus-4-1": 64000,
          "claude-opus-4-5": 64000,
          "claude-opus-4-6": 64000,
        };
        const modelMax = CLAUDE_MODEL_MAX[actualModel] ?? 32000;
        const defaultMaxTokens = thinkingEnabled ? Math.max(modelMax, 32000) : modelMax;
        const client = makeLocalAnthropic();
        result = await handleClaude({ req, res, client, model: actualModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens ?? defaultMaxTokens, thinking: thinkingEnabled, tools, toolChoice: tool_choice, startTime });
      } else if (isGeminiModel) {
        const thinkingVisible = selectedModel.endsWith("-thinking-visible");
        const thinkingEnabled = thinkingVisible || selectedModel.endsWith("-thinking");
        const actualModel = thinkingVisible
          ? selectedModel.replace(/-thinking-visible$/, "")
          : thinkingEnabled
            ? selectedModel.replace(/-thinking$/, "")
            : selectedModel;
        result = await handleGemini({ req, res, model: actualModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens, thinking: thinkingEnabled, startTime });
      } else if (isOpenRouterModel) {
        const client = makeLocalOpenRouter();
        result = await handleOpenAI({ req, res, client, model: selectedModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens, tools, toolChoice: tool_choice, startTime });
      } else {
        const client = makeLocalOpenAI();
        result = await handleOpenAI({ req, res, client, model: selectedModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens, tools, toolChoice: tool_choice, startTime });
      }
      // ✅ Success — record stats, mark friend healthy, and exit retry loop
      if (backend.kind === "friend") setHealth(backend.url, true);
      recordCallStat(backendLabel, Date.now() - startTime, result.promptTokens, result.completionTokens, result.ttftMs);
      break;
    } catch (err: unknown) {
      // ❌ Failure — record error, decide whether to retry on a different node
      recordErrorStat(backendLabel);

      const is5xx = err instanceof FriendProxyHttpError && err.status >= 500;
      const errMsg = err instanceof Error ? err.message : "";
      const isNetworkErr = err instanceof TypeError
        || ["fetch", "aborted", "terminated", "closed", "upstream", "ECONNRESET", "socket hang up", "UND_ERR"]
          .some((kw) => errMsg.includes(kw));

      if (backend.kind === "friend" && (is5xx || isNetworkErr)) {
        setHealth(backend.url, false);
        req.log.warn({ url: backend.url, attempt, is5xx, isNetworkErr }, "Friend backend marked unhealthy, considering retry");

        if (attempt < MAX_FRIEND_RETRIES && !res.headersSent) {
          const next = pickBackendExcluding(triedFriendUrls);
          if (next?.kind === "friend") {
            backend = next;
            continue; // retry with next friend node
          }
        }
      }

      req.log.error({ err }, "Proxy request failed");
      if (!res.headersSent) {
        // No response started yet — send a plain HTTP 500
        res.status(500).json({ error: { message: errMsg || "Unknown error", type: "server_error" } });
      } else if (!res.writableEnded) {
        // SSE headers sent but stream not yet closed (e.g. network error mid-stream)
        writeAndFlush(res, `data: ${JSON.stringify({ error: { message: errMsg || "Unknown error" } })}\n\n`);
        writeAndFlush(res, "data: [DONE]\n\n");
        res.end();
      }
      // else: response already fully ended (handleFriendProxy closed it) — nothing to do
      break;
    }
  }
});

// ---------------------------------------------------------------------------
// Anthropic-native /v1/messages endpoint
// Accepts Anthropic API format directly (for clients like Cherry Studio, Claude.ai compatible tools)
// ---------------------------------------------------------------------------

router.post("/v1/messages", requireApiKey, async (req: Request, res: Response) => {
  const body = req.body as {
    model?: string;
    messages: AnthropicMessage[];
    system?: string | { type: string; text: string }[];
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
    thinking?: { type: "enabled"; budget_tokens: number };
    [key: string]: unknown;
  };

  const { model, messages, system, stream, max_tokens, ...rest } = body;
  const selectedModel = model ?? "claude-sonnet-4-5";
  const maxTokens = max_tokens ?? 4096;
  const shouldStream = stream ?? false;
  const startTime = Date.now();

  req.log.info({ model: selectedModel, stream: shouldStream }, "Anthropic /v1/messages request");

  try {
    const client = makeLocalAnthropic();

    const createParams = {
      model: selectedModel,
      max_tokens: maxTokens,
      messages,
      ...(system ? { system } : {}),
      ...rest,
    } as Parameters<typeof client.messages.create>[0];

    if (shouldStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      const keepalive = setInterval(() => {
        if (!res.writableEnded) writeAndFlush(res, ": keepalive\n\n");
      }, 5000);
      req.on("close", () => clearInterval(keepalive));

      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const claudeStream = client.messages.stream(createParams as Parameters<typeof client.messages.stream>[0]);

        for await (const event of claudeStream) {
          if (event.type === "message_start") {
            inputTokens = event.message.usage.input_tokens;
          } else if (event.type === "message_delta") {
            outputTokens = event.usage.output_tokens;
          }
          writeAndFlush(res, `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
        writeAndFlush(res, "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n");
        res.end();
        recordCallStat("local", Date.now() - startTime, inputTokens, outputTokens);
      } finally {
        clearInterval(keepalive);
      }
    } else {
      const result = await client.messages.create(createParams);
      const usage = (result as { usage?: { input_tokens?: number; output_tokens?: number } }).usage ?? {};
      recordCallStat("local", Date.now() - startTime, usage.input_tokens ?? 0, usage.output_tokens ?? 0);
      res.json(result);
    }
  } catch (err: unknown) {
    recordErrorStat("local");
    req.log.error({ err }, "/v1/messages request failed");
    if (!res.headersSent) {
      res.status(500).json({ error: { type: "server_error", message: err instanceof Error ? err.message : "Unknown error" } });
    } else {
      writeAndFlush(res, `event: error\ndata: ${JSON.stringify({ type: "error", error: { type: "server_error", message: err instanceof Error ? err.message : "Unknown error" } })}\n\n`);
      res.end();
    }
  }
});

router.get("/v1/stats", requireApiKey, (_req: Request, res: Response) => {
  const allConfigs = getAllFriendProxyConfigs();
  const allLabels = ["local", ...allConfigs.map((c) => c.label)];
  const result: Record<string, unknown> = {};
  for (const label of allLabels) {
    const s = getStat(label);
    const cfg = allConfigs.find((c) => c.label === label);
    result[label] = {
      calls: s.calls,
      errors: s.errors,
      promptTokens: s.promptTokens,
      completionTokens: s.completionTokens,
      totalTokens: s.promptTokens + s.completionTokens,
      avgDurationMs: s.calls > 0 ? Math.round(s.totalDurationMs / s.calls) : 0,
      avgTtftMs: s.streamingCalls > 0 ? Math.round(s.totalTtftMs / s.streamingCalls) : null,
      health: label === "local" ? "healthy" : getCachedHealth(cfg?.url ?? "") === false ? "down" : "healthy",
      url: label === "local" ? null : cfg?.url ?? null,
      dynamic: dynamicBackends.some((d) => d.label === label),
      enabled: cfg ? cfg.enabled : true,
    };
  }
  res.json({ stats: result, uptimeSeconds: Math.round(process.uptime()), routing: routingSettings });
});

// ---------------------------------------------------------------------------
// Admin: manage dynamic backends at runtime (no restart / redeploy required)
// ---------------------------------------------------------------------------

router.get("/v1/admin/backends", requireApiKey, (_req: Request, res: Response) => {
  const apiKey = process.env.PROXY_API_KEY ?? "";
  const envConfigs = (() => {
    const list: { label: string; url: string }[] = [];
    const envKeys = ["FRIEND_PROXY_URL", ...Array.from({ length: 19 }, (_, i) => `FRIEND_PROXY_URL_${i + 2}`)];
    for (const key of envKeys) { const url = process.env[key]; if (url) list.push({ label: key.replace("FRIEND_PROXY_URL", "FRIEND"), url }); }
    return list;
  })();
  res.json({
    local: { url: null, source: "local" },
    env: envConfigs.map((c) => ({ ...c, source: "env", health: getCachedHealth(c.url) === false ? "down" : "healthy" })),
    dynamic: dynamicBackends.map((d) => ({ ...d, source: "dynamic", health: getCachedHealth(d.url) === false ? "down" : "healthy" })),
    apiKey,
  });
});

router.post("/v1/admin/backends", requireApiKey, (req: Request, res: Response) => {
  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    res.status(400).json({ error: "Valid https URL required" });
    return;
  }
  const cleanUrl = url.replace(/\/+$/, "");
  const normalizedUrl = normalizeSubNodeUrl(cleanUrl);
  const allUrls = getFriendProxyConfigs().map((c) => c.url);
  if (allUrls.includes(normalizedUrl)) { res.status(409).json({ error: "URL already in pool" }); return; }
  const label = `DYNAMIC_${dynamicBackends.length + 1}`;
  dynamicBackends.push({ label, url: cleanUrl });
  saveDynamicBackends(dynamicBackends);
  const apiKey = process.env.PROXY_API_KEY ?? "";
  probeHealth(normalizedUrl, apiKey).then((ok) => setHealth(normalizedUrl, ok)).catch(() => setHealth(normalizedUrl, false));
  res.json({ label, url: cleanUrl, source: "dynamic" });
});

router.delete("/v1/admin/backends/:label", requireApiKey, (req: Request, res: Response) => {
  const { label } = req.params;
  const before = dynamicBackends.length;
  dynamicBackends = dynamicBackends.filter((d) => d.label !== label);
  if (dynamicBackends.length === before) { res.status(404).json({ error: "Dynamic backend not found" }); return; }
  saveDynamicBackends(dynamicBackends);
  res.json({ deleted: true, label });
});

// PATCH /v1/admin/backends/:label — 切换单个节点启用/禁用
router.patch("/v1/admin/backends/:label", requireApiKey, (req: Request, res: Response) => {
  const { label } = req.params;
  const { enabled } = req.body as { enabled?: boolean };
  if (typeof enabled !== "boolean") { res.status(400).json({ error: "enabled (boolean) required" }); return; }
  const target = dynamicBackends.find((d) => d.label === label);
  if (!target) { res.status(404).json({ error: "Dynamic backend not found" }); return; }
  target.enabled = enabled;
  saveDynamicBackends(dynamicBackends);
  res.json({ label, enabled });
});

// PATCH /v1/admin/backends — 批量切换（labels 数组 + enabled 布尔值）
router.patch("/v1/admin/backends", requireApiKey, (req: Request, res: Response) => {
  const { labels, enabled } = req.body as { labels?: string[]; enabled?: boolean };
  if (!Array.isArray(labels) || typeof enabled !== "boolean") {
    res.status(400).json({ error: "labels (string[]) and enabled (boolean) required" });
    return;
  }
  const set = new Set(labels);
  let updated = 0;
  for (const d of dynamicBackends) {
    if (set.has(d.label)) { d.enabled = enabled; updated++; }
  }
  saveDynamicBackends(dynamicBackends);
  res.json({ updated, enabled });
});

router.get("/v1/admin/routing", requireApiKey, (_req: Request, res: Response) => {
  res.json(routingSettings);
});

router.patch("/v1/admin/routing", requireApiKey, (req: Request, res: Response) => {
  const { localEnabled, localFallback, fakeStream } = req.body as Partial<RoutingSettings>;
  if (typeof localEnabled === "boolean") routingSettings.localEnabled = localEnabled;
  if (typeof localFallback === "boolean") routingSettings.localFallback = localFallback;
  if (typeof fakeStream === "boolean") routingSettings.fakeStream = fakeStream;
  saveRoutingSettings();
  res.json(routingSettings);
});

// ---------------------------------------------------------------------------
// Admin: model enable/disable management
// ---------------------------------------------------------------------------

// GET /v1/admin/models — list all models with provider + enabled status
router.get("/v1/admin/models", requireApiKey, (_req: Request, res: Response) => {
  const models = ALL_MODELS.map((m) => ({
    id: m.id,
    provider: MODEL_PROVIDER_MAP.get(m.id) ?? "openrouter",
    enabled: isModelEnabled(m.id),
  }));
  const summary: Record<string, { total: number; enabled: number }> = {};
  for (const m of models) {
    if (!summary[m.provider]) summary[m.provider] = { total: 0, enabled: 0 };
    summary[m.provider].total++;
    if (m.enabled) summary[m.provider].enabled++;
  }
  res.json({ models, summary });
});

// PATCH /v1/admin/models — bulk enable/disable by ids or by provider
// Body: { ids?: string[], provider?: string, enabled: boolean }
router.patch("/v1/admin/models", requireApiKey, (req: Request, res: Response) => {
  const { ids, provider, enabled } = req.body as { ids?: string[]; provider?: string; enabled?: boolean };
  if (typeof enabled !== "boolean") { res.status(400).json({ error: "enabled (boolean) required" }); return; }

  let targets: string[] = [];
  if (Array.isArray(ids) && ids.length > 0) {
    targets = ids.filter((id) => MODEL_PROVIDER_MAP.has(id));
  } else if (typeof provider === "string") {
    targets = ALL_MODELS.map((m) => m.id).filter((id) => MODEL_PROVIDER_MAP.get(id) === provider);
  } else {
    res.status(400).json({ error: "ids (string[]) or provider (string) required" }); return;
  }

  for (const id of targets) {
    if (enabled) disabledModels.delete(id);
    else disabledModels.add(id);
  }
  saveDisabledModels(disabledModels);
  res.json({ updated: targets.length, enabled, ids: targets });
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// Distinguishes upstream HTTP errors (5xx) from network/timeout errors so the
// retry logic can make the right decision about whether to try another node.
class FriendProxyHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "FriendProxyHttpError";
  }
}

// handleFriendProxy — raw fetch (bypasses SDK SSE parsing) so chunk.usage is
// captured reliably regardless of the friend proxy's SDK version or chunk format.
// SSE headers are committed only after the first chunk arrives, which preserves
// the retry window in case the upstream connection fails immediately.
async function handleFriendProxy({
  req, res, backend, model, messages, stream, maxTokens, tools, toolChoice, startTime,
}: {
  req: Request;
  res: Response;
  backend: Extract<Backend, { kind: "friend" }>;
  model: string;
  messages: OAIMessage[];
  stream: boolean;
  maxTokens?: number;
  tools?: OAITool[];
  toolChoice?: unknown;
  startTime: number;
}): Promise<{ promptTokens: number; completionTokens: number; ttftMs?: number }> {
  const body: Record<string, unknown> = { model, messages, stream };
  body["max_tokens"] = maxTokens ?? 16000; // always override sub-node's potentially low default
  if (stream) body["stream_options"] = { include_usage: true };
  if (tools?.length) body["tools"] = tools;
  if (toolChoice !== undefined) body["tool_choice"] = toolChoice;

  // ── Non-streaming (or fake-stream when client wants stream but we call non-stream) ──
  if (!stream) {
    const fetchRes = await fetch(`${backend.url}/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${backend.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (!fetchRes.ok) {
      const errText = await fetchRes.text().catch(() => "unknown");
      throw new FriendProxyHttpError(fetchRes.status, `Friend proxy error ${fetchRes.status}: ${errText}`);
    }
    const json = await fetchRes.json() as Record<string, unknown>;
    res.json(json);
    const usage = json["usage"] as { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
    if ((usage?.prompt_tokens ?? 0) === 0) {
      const inputChars = messages.reduce((acc, m) => {
        if (typeof m.content === "string") return acc + m.content.length;
        if (Array.isArray(m.content))
          return acc + (m.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === "text").reduce((a, p) => a + (p.text?.length ?? 0), 0);
        return acc;
      }, 0);
      const outputChars = (json["choices"] as Array<{ message?: { content?: string } }>)?.[0]?.message?.content?.length ?? 0;
      return { promptTokens: Math.ceil(inputChars / 4), completionTokens: Math.ceil(outputChars / 4) };
    }
    return { promptTokens: usage?.prompt_tokens ?? 0, completionTokens: usage?.completion_tokens ?? 0 };
  }

  // ── Streaming ────────────────────────────────────────────────────────────
  const fetchRes = await fetch(`${backend.url}/v1/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${backend.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(600_000),
  });

  if (!fetchRes.ok) {
    const errText = await fetchRes.text().catch(() => "unknown");
    throw new FriendProxyHttpError(fetchRes.status, `Friend proxy error ${fetchRes.status}: ${errText}`);
  }

  const contentType = fetchRes.headers.get("content-type") ?? "";
  if (contentType.includes("application/json") && routingSettings.fakeStream) {
    req.log.info("Friend returned JSON for stream request — fake-streaming");
    const json = await fetchRes.json() as Record<string, unknown>;
    const result = await fakeStreamResponse(res, json, startTime);
    if (result.promptTokens === 0) {
      const inputChars = messages.reduce((acc, m) => {
        if (typeof m.content === "string") return acc + m.content.length;
        if (Array.isArray(m.content))
          return acc + (m.content as Array<{ type: string; text?: string }>)
            .filter((p) => p.type === "text").reduce((a, p) => a + (p.text?.length ?? 0), 0);
        return acc;
      }, 0);
      const outputContent = ((json["choices"] as Array<{ message?: { content?: string } }>)?.[0]?.message?.content ?? "").length;
      return { promptTokens: Math.ceil(inputChars / 4), completionTokens: Math.ceil(outputContent / 4), ttftMs: result.ttftMs };
    }
    return result;
  }

  setSseHeaders(res);
  const keepaliveTimer = setInterval(() => writeAndFlush(res, ": keep-alive\n\n"), 15_000);

  let promptTokens = 0;
  let completionTokens = 0;
  let ttftMs: number | undefined;
  let outputChars = 0;

  try {

    const reader = fetchRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") { writeAndFlush(res, "data: [DONE]\n\n"); continue; }
          try {
            const chunk = JSON.parse(data) as Record<string, unknown>;
            // Capture usage from any chunk that carries it
            const usage = chunk["usage"] as { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
            if (usage && typeof usage === "object") {
              promptTokens = usage.prompt_tokens ?? promptTokens;
              completionTokens = usage.completion_tokens ?? completionTokens;
            }
            // Record TTFT + accumulate output chars for fallback estimation
            const deltaContent = (chunk["choices"] as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
            if (deltaContent) {
              if (ttftMs === undefined) ttftMs = Date.now() - startTime;
              outputChars += deltaContent.length;
            }
            writeAndFlush(res, `data: ${JSON.stringify(chunk)}\n\n`);
          } catch { /* skip malformed chunk */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    clearInterval(keepaliveTimer);
  }

  res.end();

  // Fallback: estimate tokens from char count when sub-node didn't return usage
  if (promptTokens === 0) {
    const inputChars = messages.reduce((acc, m) => {
      if (typeof m.content === "string") return acc + m.content.length;
      if (Array.isArray(m.content))
        return acc + (m.content as Array<{ type: string; text?: string }>)
          .filter((p) => p.type === "text").reduce((a, p) => a + (p.text?.length ?? 0), 0);
      return acc;
    }, 0);
    promptTokens = Math.ceil(inputChars / 4);
    completionTokens = Math.ceil(outputChars / 4);
  }

  return { promptTokens, completionTokens, ttftMs };
}

async function handleOpenAI({
  req, res, client, model, messages, stream, maxTokens, tools, toolChoice, startTime,
}: {
  req: Request;
  res: Response;
  client: OpenAI;
  model: string;
  messages: OAIMessage[];
  stream: boolean;
  maxTokens?: number;
  tools?: OAITool[];
  toolChoice?: unknown;
  startTime: number;
}): Promise<{ promptTokens: number; completionTokens: number; ttftMs?: number }> {
  const params: Parameters<typeof client.chat.completions.create>[0] = {
    model,
    messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
    stream,
  };
  if (maxTokens) (params as Record<string, unknown>)["max_completion_tokens"] = maxTokens;
  if (tools?.length) (params as Record<string, unknown>)["tools"] = tools;
  if (toolChoice !== undefined) (params as Record<string, unknown>)["tool_choice"] = toolChoice;

  if (stream) {
    try {
      setSseHeaders(res);
      let ttftMs: number | undefined;
      let promptTokens = 0;
      let completionTokens = 0;
      const streamResult = await client.chat.completions.create({
        ...params,
        stream: true,
        stream_options: { include_usage: true },
      });
      for await (const chunk of streamResult) {
        if (ttftMs === undefined && (chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.delta?.tool_calls)) {
          ttftMs = Date.now() - startTime;
        }
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? 0;
          completionTokens = chunk.usage.completion_tokens ?? 0;
        }
        writeAndFlush(res, `data: ${JSON.stringify(chunk)}\n\n`);
      }
      writeAndFlush(res, "data: [DONE]\n\n");
      res.end();
      return { promptTokens, completionTokens, ttftMs };
    } catch (streamErr) {
      if (res.headersSent || !routingSettings.fakeStream) throw streamErr;
      req.log.warn({ err: streamErr }, "Real streaming failed, falling back to fake-stream");
      const result = await client.chat.completions.create({ ...params, stream: false });
      return fakeStreamResponse(res, result as unknown as Record<string, unknown>, startTime);
    }
  } else {
    const result = await client.chat.completions.create({ ...params, stream: false });
    res.json(result);
    return {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
    };
  }
}

async function handleGemini({
  req, res, model, messages, stream, maxTokens, thinking = false, startTime,
}: {
  req: Request;
  res: Response;
  model: string;
  messages: OAIMessage[];
  stream: boolean;
  maxTokens?: number;
  thinking?: boolean;
  startTime: number;
}): Promise<{ promptTokens: number; completionTokens: number; ttftMs?: number }> {
  const client = makeLocalGemini();

  let systemInstruction: string | undefined;
  const contents: { role: string; parts: { text: string }[] }[] = [];

  for (const msg of messages) {
    const textContent = typeof msg.content === "string"
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.filter((p: OAIContentPart) => p.type === "text").map((p) => (p as { type: "text"; text: string }).text).join("\n")
        : "";
    if (msg.role === "system") {
      systemInstruction = systemInstruction ? `${systemInstruction}\n${textContent}` : textContent;
    } else {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: textContent || " " }],
      });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: " " }] });
  }

  const config: Record<string, unknown> = {};
  if (maxTokens) config.maxOutputTokens = maxTokens;
  if (thinking) {
    config.thinkingConfig = { thinkingBudget: maxTokens ? Math.min(maxTokens, 32768) : 16384 };
  }

  if (stream) {
    try {
      setSseHeaders(res);
      let ttftMs: number | undefined;
      let promptTokens = 0;
      let completionTokens = 0;
      const chatId = `chatcmpl-${Date.now()}`;

      const response = await client.models.generateContentStream({
        model,
        contents,
        config: {
          ...config,
          ...(systemInstruction ? { systemInstruction } : {}),
        },
      });

      for await (const chunk of response) {
        const text = chunk.text ?? "";
        if (ttftMs === undefined && text) {
          ttftMs = Date.now() - startTime;
        }
        if (chunk.usageMetadata) {
          promptTokens = chunk.usageMetadata.promptTokenCount ?? 0;
          completionTokens = chunk.usageMetadata.candidatesTokenCount ?? 0;
        }
        const oaiChunk = {
          id: chatId,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model,
          choices: [{
            index: 0,
            delta: { content: text },
            finish_reason: chunk.candidates?.[0]?.finishReason === "STOP" ? "stop" : null,
          }],
        };
        writeAndFlush(res, `data: ${JSON.stringify(oaiChunk)}\n\n`);
      }

      writeAndFlush(res, "data: [DONE]\n\n");
      res.end();
      return { promptTokens, completionTokens, ttftMs };
    } catch (streamErr) {
      if (res.headersSent || !routingSettings.fakeStream) throw streamErr;
      req.log.warn({ err: streamErr }, "Gemini streaming failed, falling back to fake-stream");
      const response = await client.models.generateContent({
        model, contents,
        config: { ...config, ...(systemInstruction ? { systemInstruction } : {}) },
      });
      const text = response.text ?? "";
      const pTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const cTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
      const json = {
        id: `chatcmpl-${Date.now()}`, object: "chat.completion",
        created: Math.floor(Date.now() / 1000), model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        usage: { prompt_tokens: pTokens, completion_tokens: cTokens, total_tokens: pTokens + cTokens },
      };
      return fakeStreamResponse(res, json as unknown as Record<string, unknown>, startTime);
    }
  } else {
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        ...config,
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });

    const text = response.text ?? "";
    const promptTokens = response.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = response.usageMetadata?.candidatesTokenCount ?? 0;

    res.json({
      id: `chatcmpl-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: "stop",
      }],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens,
      },
    });
    return { promptTokens, completionTokens };
  }
}

async function handleClaude({
  req, res, client, model, messages, stream, maxTokens, thinking = false, tools, toolChoice, startTime,
}: {
  req: Request;
  res: Response;
  client: Anthropic;
  model: string;
  messages: OAIMessage[];
  stream: boolean;
  maxTokens: number;
  thinking?: boolean;
  tools?: OAITool[];
  toolChoice?: unknown;
  startTime: number;
}): Promise<{ promptTokens: number; completionTokens: number; ttftMs?: number }> {
  const THINKING_BUDGET = 16000;

  // Extract system prompt
  const systemMessages = messages
    .filter((m) => m.role === "system")
    .map((m) => (typeof m.content === "string" ? m.content : (m.content as OAIContentPart[]).map((p) => (p.type === "text" ? (p as { type: "text"; text: string }).text : "")).join("")))
    .join("\n");

  // Convert all messages including tool_calls / tool roles
  const chatMessages = convertMessagesForClaude(messages);

  const thinkingParam = thinking
    ? { thinking: { type: "enabled" as const, budget_tokens: THINKING_BUDGET } }
    : {};

  // Convert tools to Anthropic format
  const anthropicTools = tools?.length ? convertToolsForClaude(tools) : undefined;
  // Convert tool_choice
  let anthropicToolChoice: unknown;
  if (toolChoice !== undefined && anthropicTools?.length) {
    if (toolChoice === "auto") anthropicToolChoice = { type: "auto" };
    else if (toolChoice === "none") anthropicToolChoice = { type: "none" };
    else if (toolChoice === "required") anthropicToolChoice = { type: "any" };
    else if (typeof toolChoice === "object" && (toolChoice as Record<string, unknown>).type === "function") {
      anthropicToolChoice = { type: "tool", name: ((toolChoice as Record<string, unknown>).function as Record<string, unknown>).name };
    }
  }

  const buildCreateParams = () => ({
    model,
    max_tokens: maxTokens,
    ...(systemMessages ? { system: systemMessages } : {}),
    ...thinkingParam,
    messages: chatMessages,
    ...(anthropicTools?.length ? { tools: anthropicTools } : {}),
    ...(anthropicToolChoice ? { tool_choice: anthropicToolChoice } : {}),
  });

  const msgId = `msg_${Date.now()}`;

  if (stream) {
    setSseHeaders(res);
    const keepalive = setInterval(() => {
      if (!res.writableEnded) writeAndFlush(res, ": keepalive\n\n");
    }, 5000);
    req.on("close", () => clearInterval(keepalive));

    try {
      const claudeStream = client.messages.stream(buildCreateParams() as Parameters<typeof client.messages.stream>[0]);

      let inputTokens = 0;
      let outputTokens = 0;
      let thinkingStarted = false;
      let ttftMs: number | undefined;
      // Track current tool_use block index for streaming
      let currentToolIndex = -1;
      const toolIndexMap = new Map<number, number>(); // content_block index → tool_calls array index
      let toolCallCount = 0;

      for await (const event of claudeStream) {
        if (event.type === "message_start") {
          inputTokens = event.message.usage.input_tokens;
          writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] })}\n\n`);

        } else if (event.type === "content_block_start") {
          const block = event.content_block;

          if (block.type === "thinking") {
            if (!thinkingStarted) {
              thinkingStarted = true;
              writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: "<thinking>\n" }, finish_reason: null }] })}\n\n`);
            }
          } else if (block.type === "tool_use") {
            if (thinkingStarted) {
              writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: "\n</thinking>\n\n" }, finish_reason: null }] })}\n\n`);
              thinkingStarted = false;
            }
            // Map this content block index to tool_calls array index
            currentToolIndex = toolCallCount++;
            toolIndexMap.set(event.index, currentToolIndex);
            if (ttftMs === undefined) ttftMs = Date.now() - startTime;
            // Send tool_call start chunk
            writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { tool_calls: [{ index: currentToolIndex, id: block.id, type: "function", function: { name: block.name, arguments: "" } }] }, finish_reason: null }] })}\n\n`);
          } else if (block.type === "text") {
            if (thinkingStarted) {
              writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: "\n</thinking>\n\n" }, finish_reason: null }] })}\n\n`);
              thinkingStarted = false;
            }
          }

        } else if (event.type === "content_block_delta") {
          const delta = event.delta;

          if (delta.type === "thinking_delta") {
            writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: delta.thinking }, finish_reason: null }] })}\n\n`);
          } else if (delta.type === "text_delta") {
            if (ttftMs === undefined) ttftMs = Date.now() - startTime;
            writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: delta.text }, finish_reason: null }] })}\n\n`);
          } else if (delta.type === "input_json_delta") {
            // Tool argument streaming
            const toolIdx = toolIndexMap.get(event.index) ?? currentToolIndex;
            writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { tool_calls: [{ index: toolIdx, function: { arguments: delta.partial_json } }] }, finish_reason: null }] })}\n\n`);
          }

        } else if (event.type === "message_delta") {
          outputTokens = event.usage.output_tokens;
          const stopReason = event.delta.stop_reason;
          const finishReason = stopReason === "tool_use" ? "tool_calls" : (stopReason ?? "stop");
          writeAndFlush(res, `data: ${JSON.stringify({ id: msgId, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: {}, finish_reason: finishReason }], usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens } })}\n\n`);
        }
      }

      writeAndFlush(res, "data: [DONE]\n\n");
      res.end();
      return { promptTokens: inputTokens, completionTokens: outputTokens, ttftMs };
    } finally {
      clearInterval(keepalive);
    }

  } else {
    // Non-streaming
    const result = await client.messages.create(buildCreateParams() as Parameters<typeof client.messages.create>[0]);

    const textParts: string[] = [];
    const toolCalls: OAIToolCall[] = [];

    for (const block of result.content) {
      if (block.type === "thinking") {
        textParts.push(`<thinking>\n${(block as { type: "thinking"; thinking: string }).thinking}\n</thinking>`);
      } else if (block.type === "text") {
        textParts.push((block as { type: "text"; text: string }).text);
      } else if (block.type === "tool_use") {
        const toolBlock = block as { type: "tool_use"; id: string; name: string; input: unknown };
        toolCalls.push({
          id: toolBlock.id,
          type: "function",
          function: {
            name: toolBlock.name,
            arguments: JSON.stringify(toolBlock.input),
          },
        });
      }
    }

    const text = textParts.join("\n\n");
    const stopReason = result.stop_reason;
    const finishReason = stopReason === "tool_use" ? "tool_calls" : (stopReason ?? "stop");

    res.json({
      id: result.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{
        index: 0,
        message: {
          role: "assistant",
          content: text || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
        finish_reason: finishReason,
      }],
      usage: {
        prompt_tokens: result.usage.input_tokens,
        completion_tokens: result.usage.output_tokens,
        total_tokens: result.usage.input_tokens + result.usage.output_tokens,
      },
    });
    return { promptTokens: result.usage.input_tokens, completionTokens: result.usage.output_tokens };
  }
}

export default router;
