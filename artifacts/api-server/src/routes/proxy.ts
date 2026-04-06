import { Router, type IRouter, type Request, type Response } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
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
const HEALTH_TIMEOUT_MS = 5_000; // 5s timeout per check

// ---------------------------------------------------------------------------
// Dynamic backends (file-persisted, survives restarts, reset on redeploy)
// ---------------------------------------------------------------------------

const DYNAMIC_FILE = resolve(process.cwd(), "dynamic_backends.json");

interface DynamicBackend { label: string; url: string; enabled?: boolean }

function loadDynamicBackends(): DynamicBackend[] {
  try {
    if (existsSync(DYNAMIC_FILE)) return JSON.parse(readFileSync(DYNAMIC_FILE, "utf8"));
  } catch {}
  return [];
}

function saveDynamicBackends(list: DynamicBackend[]): void {
  try { writeFileSync(DYNAMIC_FILE, JSON.stringify(list, null, 2)); } catch {}
}

let dynamicBackends: DynamicBackend[] = loadDynamicBackends();

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

const DISABLED_MODELS_FILE = resolve(process.cwd(), "disabled_models.json");

function loadDisabledModels(): Set<string> {
  try {
    if (existsSync(DISABLED_MODELS_FILE)) {
      const list = JSON.parse(readFileSync(DISABLED_MODELS_FILE, "utf8"));
      if (Array.isArray(list)) return new Set<string>(list);
    }
  } catch {}
  return new Set<string>();
}

function saveDisabledModels(set: Set<string>): void {
  try {
    const dir = dirname(DISABLED_MODELS_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DISABLED_MODELS_FILE, JSON.stringify([...set], null, 2));
  } catch {}
}

let disabledModels: Set<string> = loadDisabledModels();

function isModelEnabled(id: string): boolean {
  return !disabledModels.has(id);
}

// Normalize sub-node endpoint URL — ensures it ends with /api.
// Correct format: https://{project}.replit.app/api
// Local backends (OpenAI/Anthropic/Gemini) have their own routes and never pass through here.
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
  const pool: Backend[] = [];

  const localKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const localBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (localKey && localBase) pool.push({ kind: "local" });

  for (const { label, url, apiKey } of getFriendProxyConfigs()) {
    const healthy = getCachedHealth(url);
    // Include if: healthy=true OR never checked yet (optimistic until first result)
    if (healthy !== false) {
      pool.push({ kind: "friend", label, url, apiKey });
    }
  }

  // Fallback: if all friends are down, use local only
  if (pool.length === 0) pool.push({ kind: "local" });

  return pool;
}

let requestCounter = 0;

function pickBackend(): Backend {
  const pool = buildBackendPool();
  const backend = pool[requestCounter % pool.length];
  requestCounter++;
  return backend;
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


// ---------------------------------------------------------------------------
// Per-backend usage statistics (resets on server restart)
// ---------------------------------------------------------------------------

interface BackendStat {
  calls: number;
  errors: number;
  promptTokens: number;
  completionTokens: number;
  totalDurationMs: number;
  totalTtftMs: number;
  streamingCalls: number;
}

const statsMap = new Map<string, BackendStat>();

function getStat(label: string): BackendStat {
  if (!statsMap.has(label)) {
    statsMap.set(label, { calls: 0, errors: 0, promptTokens: 0, completionTokens: 0, totalDurationMs: 0, totalTtftMs: 0, streamingCalls: 0 });
  }
  return statsMap.get(label)!;
}

function recordCallStat(label: string, durationMs: number, prompt: number, completion: number, ttftMs?: number): void {
  const s = getStat(label);
  s.calls++;
  s.promptTokens += prompt;
  s.completionTokens += completion;
  s.totalDurationMs += durationMs;
  if (ttftMs !== undefined) { s.totalTtftMs += ttftMs; s.streamingCalls++; }
}

function recordErrorStat(label: string): void { getStat(label).errors++; }

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
  const isClaudeModel = ANTHROPIC_BASE_MODELS.some((base) =>
    selectedModel === base || selectedModel.startsWith(`${base}-thinking`)
  );
  const shouldStream = stream ?? false;
  const backend = pickBackend();
  const backendLabel = backend.kind === "local" ? "local" : backend.label;
  const startTime = Date.now();

  // SillyTavern 兼容模式：对 Claude 模型自动追加「继续」消息（仅无 tool calling 时）
  const finalMessages = (isClaudeModel && getSillyTavernMode() && !tools?.length)
    ? [...messages, { role: "user" as const, content: "继续" }]
    : messages;

  req.log.info({ model: selectedModel, backend: backendLabel, counter: requestCounter - 1, sillyTavern: isClaudeModel && getSillyTavernMode(), toolCount: tools?.length ?? 0 }, "Proxy request");

  try {
    let result: { promptTokens: number; completionTokens: number; ttftMs?: number };
    if (backend.kind === "friend") {
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
    } else {
      const client = makeLocalOpenAI();
      result = await handleOpenAI({ req, res, client, model: selectedModel, messages: finalMessages, stream: shouldStream, maxTokens: max_tokens, tools, toolChoice: tool_choice, startTime });
    }
    recordCallStat(backendLabel, Date.now() - startTime, result.promptTokens, result.completionTokens, result.ttftMs);
  } catch (err: unknown) {
    recordErrorStat(backendLabel);
    if (backend.kind === "friend") {
      const isNetworkErr = err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"));
      if (isNetworkErr) {
        setHealth(backend.url, false);
        req.log.warn({ url: backend.url }, "Friend backend marked unhealthy after failure");
      }
    }
    req.log.error({ err }, "Proxy request failed");
    if (!res.headersSent) {
      res.status(500).json({ error: { message: err instanceof Error ? err.message : "Unknown error", type: "server_error" } });
    } else {
      writeAndFlush(res, `data: ${JSON.stringify({ error: { message: err instanceof Error ? err.message : "Unknown error" } })}\n\n`);
      writeAndFlush(res, "data: [DONE]\n\n");
      res.end();
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
  res.json({ stats: result, uptimeSeconds: Math.round(process.uptime()) });
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
  const allUrls = getFriendProxyConfigs().map((c) => c.url);
  if (allUrls.includes(cleanUrl)) { res.status(409).json({ error: "URL already in pool" }); return; }
  const label = `DYNAMIC_${dynamicBackends.length + 1}`;
  dynamicBackends.push({ label, url: cleanUrl });
  saveDynamicBackends(dynamicBackends);
  // Kick off immediate health check
  const apiKey = process.env.PROXY_API_KEY ?? "";
  probeHealth(cleanUrl, apiKey).then((ok) => setHealth(cleanUrl, ok)).catch(() => setHealth(cleanUrl, false));
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

// handleFriendProxy — raw fetch (bypasses SDK SSE parsing) so chunk.usage is
// captured reliably regardless of the friend proxy's SDK version or chunk format.
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
  if (maxTokens) body["max_tokens"] = maxTokens;
  if (stream) body["stream_options"] = { include_usage: true };
  if (tools?.length) body["tools"] = tools;
  if (toolChoice !== undefined) body["tool_choice"] = toolChoice;

  const fetchRes = await fetch(`${backend.url}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${backend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!fetchRes.ok) {
    const errText = await fetchRes.text().catch(() => "unknown");
    throw new Error(`Friend proxy error ${fetchRes.status}: ${errText}`);
  }

  // ── Streaming ────────────────────────────────────────────────────────────
  if (stream) {
    setSseHeaders(res);
    let promptTokens = 0;
    let completionTokens = 0;
    let ttftMs: number | undefined;

    const reader = fetchRes.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Process all complete lines in the buffer
        const lines = buf.split("\n");
        buf = lines.pop() ?? ""; // keep the incomplete last line

        for (const line of lines) {
          const trimmed = line.trimEnd();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            writeAndFlush(res, "data: [DONE]\n\n");
            continue;
          }
          try {
            const chunk = JSON.parse(data) as Record<string, unknown>;
            // Capture usage from any chunk that carries it
            const usage = chunk["usage"] as { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
            if (usage && typeof usage === "object") {
              promptTokens = usage.prompt_tokens ?? promptTokens;
              completionTokens = usage.completion_tokens ?? completionTokens;
            }
            // Record TTFT on first content token
            if (ttftMs === undefined) {
              const choices = chunk["choices"] as Array<{ delta?: { content?: string } }> | undefined;
              if (choices?.[0]?.delta?.content) ttftMs = Date.now() - startTime;
            }
            writeAndFlush(res, `data: ${JSON.stringify(chunk)}\n\n`);
          } catch { /* skip malformed chunk */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
    res.end();
    return { promptTokens, completionTokens, ttftMs };
  }

  // ── Non-streaming ────────────────────────────────────────────────────────
  const json = await fetchRes.json() as Record<string, unknown>;
  res.json(json);
  const usage = json["usage"] as { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
  };
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
  } else {
    const result = await client.chat.completions.create({ ...params, stream: false });
    res.json(result);
    return {
      promptTokens: result.usage?.prompt_tokens ?? 0,
      completionTokens: result.usage?.completion_tokens ?? 0,
    };
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
