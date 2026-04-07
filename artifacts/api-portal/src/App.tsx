import { useState, useEffect, useCallback } from "react";
import SetupWizard from "./components/SetupWizard";
import UpdateBadge from "./components/UpdateBadge";

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

type Provider = "openai" | "anthropic" | "gemini" | "openrouter";

interface ModelEntry {
  id: string;
  label: string;
  provider: Provider;
  desc: string;
  badge?: "thinking" | "thinking-visible" | "tools" | "reasoning";
  context?: string;
}

const OPENAI_MODELS: ModelEntry[] = [
  { id: "gpt-5.2", label: "GPT-5.2", provider: "openai", desc: "最新旗舰多模态模型", context: "128K", badge: "tools" },
  { id: "gpt-5.1", label: "GPT-5.1", provider: "openai", desc: "旗舰多模态模型", context: "128K", badge: "tools" },
  { id: "gpt-5", label: "GPT-5", provider: "openai", desc: "旗舰多模态模型", context: "128K", badge: "tools" },
  { id: "gpt-5-mini", label: "GPT-5 Mini", provider: "openai", desc: "高性价比快速模型", context: "128K", badge: "tools" },
  { id: "gpt-5-nano", label: "GPT-5 Nano", provider: "openai", desc: "超轻量边缘模型", context: "128K", badge: "tools" },
  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", desc: "稳定通用旗舰模型", context: "1M", badge: "tools" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini", provider: "openai", desc: "均衡速度与质量", context: "1M", badge: "tools" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano", provider: "openai", desc: "超高速轻量模型", context: "1M", badge: "tools" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", desc: "多模态旗舰（图文音）", context: "128K", badge: "tools" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai", desc: "轻量多模态模型", context: "128K", badge: "tools" },
  { id: "o4-mini", label: "o4 Mini", provider: "openai", desc: "推理模型，快速高效", context: "200K", badge: "reasoning" },
  { id: "o4-mini-thinking", label: "o4 Mini (thinking)", provider: "openai", desc: "o4 Mini 思考别名", context: "200K", badge: "thinking" },
  { id: "o3", label: "o3", provider: "openai", desc: "强推理旗舰模型", context: "200K", badge: "reasoning" },
  { id: "o3-thinking", label: "o3 (thinking)", provider: "openai", desc: "o3 思考别名", context: "200K", badge: "thinking" },
  { id: "o3-mini", label: "o3 Mini", provider: "openai", desc: "高效推理模型", context: "200K", badge: "reasoning" },
  { id: "o3-mini-thinking", label: "o3 Mini (thinking)", provider: "openai", desc: "o3 Mini 思考别名", context: "200K", badge: "thinking" },
];

const ANTHROPIC_MODELS: ModelEntry[] = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic", desc: "顶级推理与智能体任务", context: "200K", badge: "tools" },
  { id: "claude-opus-4-6-thinking", label: "Claude Opus 4.6 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-opus-4-6-thinking-visible", label: "Claude Opus 4.6 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "anthropic", desc: "旗舰推理模型", context: "200K", badge: "tools" },
  { id: "claude-opus-4-5-thinking", label: "Claude Opus 4.5 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-opus-4-5-thinking-visible", label: "Claude Opus 4.5 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-opus-4-1", label: "Claude Opus 4.1", provider: "anthropic", desc: "旗舰模型（稳定版）", context: "200K", badge: "tools" },
  { id: "claude-opus-4-1-thinking", label: "Claude Opus 4.1 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-opus-4-1-thinking-visible", label: "Claude Opus 4.1 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", desc: "速度与智能最佳平衡", context: "200K", badge: "tools" },
  { id: "claude-sonnet-4-6-thinking", label: "Claude Sonnet 4.6 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-sonnet-4-6-thinking-visible", label: "Claude Sonnet 4.6 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "anthropic", desc: "均衡性价比旗舰", context: "200K", badge: "tools" },
  { id: "claude-sonnet-4-5-thinking", label: "Claude Sonnet 4.5 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-sonnet-4-5-thinking-visible", label: "Claude Sonnet 4.5 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", desc: "超快速轻量模型", context: "200K", badge: "tools" },
  { id: "claude-haiku-4-5-thinking", label: "Claude Haiku 4.5 (thinking)", provider: "anthropic", desc: "扩展思考（隐藏）", context: "200K", badge: "thinking" },
  { id: "claude-haiku-4-5-thinking-visible", label: "Claude Haiku 4.5 (thinking visible)", provider: "anthropic", desc: "扩展思考（可见）", context: "200K", badge: "thinking-visible" },
];

const GEMINI_MODELS: ModelEntry[] = [
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "gemini", desc: "最新旗舰多模态模型", context: "2M", badge: "tools" },
  { id: "gemini-3.1-pro-preview-thinking", label: "Gemini 3.1 Pro Preview (thinking)", provider: "gemini", desc: "扩展思考（隐藏）", context: "2M", badge: "thinking" },
  { id: "gemini-3.1-pro-preview-thinking-visible", label: "Gemini 3.1 Pro Preview (thinking visible)", provider: "gemini", desc: "扩展思考（可见）", context: "2M", badge: "thinking-visible" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", provider: "gemini", desc: "极速多模态模型", context: "1M", badge: "tools" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", desc: "推理旗舰，强代码能力", context: "1M", badge: "tools" },
  { id: "gemini-2.5-pro-thinking", label: "Gemini 2.5 Pro (thinking)", provider: "gemini", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "gemini-2.5-pro-thinking-visible", label: "Gemini 2.5 Pro (thinking visible)", provider: "gemini", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", desc: "速度与质量兼备", context: "1M", badge: "tools" },
  { id: "gemini-2.5-flash-thinking", label: "Gemini 2.5 Flash (thinking)", provider: "gemini", desc: "扩展思考（隐藏）", context: "1M", badge: "thinking" },
  { id: "gemini-2.5-flash-thinking-visible", label: "Gemini 2.5 Flash (thinking visible)", provider: "gemini", desc: "扩展思考（可见）", context: "1M", badge: "thinking-visible" },
];

const OPENROUTER_MODELS: ModelEntry[] = [
  { id: "x-ai/grok-4.20", label: "Grok 4.20", provider: "openrouter", desc: "xAI 最新旗舰推理模型", badge: "tools" },
  { id: "x-ai/grok-4.1-fast", label: "Grok 4.1 Fast", provider: "openrouter", desc: "xAI 高速对话模型", badge: "tools" },
  { id: "x-ai/grok-4-fast", label: "Grok 4 Fast", provider: "openrouter", desc: "xAI 快速模型", badge: "tools" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "openrouter", desc: "Meta 多模态旗舰" },
  { id: "meta-llama/llama-4-scout", label: "Llama 4 Scout", provider: "openrouter", desc: "Meta 长上下文模型", context: "10M" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2", provider: "openrouter", desc: "中文/代码强模型", badge: "tools" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1", provider: "openrouter", desc: "开源强推理模型", badge: "reasoning" },
  { id: "deepseek/deepseek-r1-0528", label: "DeepSeek R1 0528", provider: "openrouter", desc: "R1 最新版本", badge: "reasoning" },
  { id: "mistralai/mistral-small-2603", label: "Mistral Small 2603", provider: "openrouter", desc: "轻量高效模型", badge: "tools" },
  { id: "qwen/qwen3.5-122b-a10b", label: "Qwen 3.5 122B", provider: "openrouter", desc: "Alibaba 大参数旗舰" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (OR)", provider: "openrouter", desc: "通过 OpenRouter 的 Gemini" },
  { id: "anthropic/claude-opus-4.6", label: "Claude Opus 4.6 (OR)", provider: "openrouter", desc: "通过 OpenRouter 的 Claude", badge: "tools" },
  { id: "cohere/command-a", label: "Command A", provider: "openrouter", desc: "Cohere 企业级模型", badge: "tools" },
  { id: "amazon/nova-premier-v1", label: "Nova Premier V1", provider: "openrouter", desc: "Amazon 旗舰多模态" },
  { id: "baidu/ernie-4.5-300b-a47b", label: "ERNIE 4.5 300B", provider: "openrouter", desc: "百度 MoE 大参数模型" },
];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const PROVIDER_COLORS: Record<Provider, { bg: string; border: string; dot: string; text: string; label: string }> = {
  openai: { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.25)", dot: "#60a5fa", text: "#93c5fd", label: "OpenAI" },
  anthropic: { bg: "rgba(251,146,60,0.1)", border: "rgba(251,146,60,0.25)", dot: "#fb923c", text: "#fdba74", label: "Anthropic" },
  gemini: { bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.25)", dot: "#34d399", text: "#6ee7b7", label: "Google Gemini" },
  openrouter: { bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)", dot: "#a78bfa", text: "#c4b5fd", label: "OpenRouter" },
};

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement("textarea");
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand("copy"); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} style={{
      background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)",
      border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.12)"}`,
      color: copied ? "#4ade80" : "#94a3b8", borderRadius: "6px",
      padding: "4px 10px", fontSize: "12px", cursor: "pointer",
      transition: "all 0.15s", whiteSpace: "nowrap", flexShrink: 0,
    }}>
      {copied ? "已复制!" : (label ?? "复制")}
    </button>
  );
}

function CodeBlock({ code, copyText }: { code: string; copyText?: string }) {
  return (
    <div style={{ position: "relative", marginTop: "8px" }}>
      <pre style={{
        background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px", padding: "12px 16px", fontFamily: "Menlo, monospace",
        fontSize: "12.5px", color: "#e2e8f0", overflowX: "auto", margin: 0, paddingRight: "72px",
        lineHeight: "1.6",
      }}>{code}</pre>
      <div style={{ position: "absolute", top: "8px", right: "8px" }}>
        <CopyButton text={copyText ?? code} />
      </div>
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: "12px", padding: "24px", ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: "11px", fontWeight: 700, color: "#64748b", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: "16px", marginTop: 0,
    }}>{children}</h2>
  );
}

function Badge({ variant }: { variant: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    thinking: { color: "#c084fc", bg: "rgba(192,132,252,0.15)", border: "rgba(192,132,252,0.35)" },
    "thinking-visible": { color: "#34d399", bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.3)" },
    tools: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)" },
    reasoning: { color: "#f472b6", bg: "rgba(244,114,182,0.1)", border: "rgba(244,114,182,0.3)" },
  };
  const labels: Record<string, string> = { thinking: "思考", "thinking-visible": "思考可见", tools: "工具", reasoning: "推理" };
  const s = styles[variant] ?? styles.tools;
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: "4px", padding: "1px 5px", flexShrink: 0,
    }}>{labels[variant] ?? variant}</span>
  );
}

function MethodBadge({ method }: { method: "GET" | "POST" }) {
  return (
    <span style={{
      background: method === "GET" ? "rgba(34,197,94,0.15)" : "rgba(99,102,241,0.2)",
      color: method === "GET" ? "#4ade80" : "#818cf8",
      border: `1px solid ${method === "GET" ? "rgba(34,197,94,0.3)" : "rgba(99,102,241,0.3)"}`,
      borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: 700,
      fontFamily: "Menlo, monospace", flexShrink: 0,
    }}>{method}</span>
  );
}

function ModelGroup({ title, models, provider, expanded, onToggle }: {
  title: string; models: ModelEntry[]; provider: Provider;
  expanded: boolean; onToggle: () => void;
}) {
  const c = PROVIDER_COLORS[provider];
  const base = models.filter((m) => !m.badge || (m.badge !== "thinking" && m.badge !== "thinking-visible"));
  const thinking = models.filter((m) => m.badge === "thinking" || m.badge === "thinking-visible");
  return (
    <div style={{ marginBottom: "10px" }}>
      <button onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: "10px", width: "100%",
        background: c.bg, border: `1px solid ${c.border}`, borderRadius: "8px",
        padding: "10px 14px", cursor: "pointer", textAlign: "left",
      }}>
        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: c.text, fontSize: "13px", flex: 1 }}>{title}</span>
        <span style={{ fontSize: "12px", color: "#475569" }}>{base.length} 基础 · {thinking.length > 0 ? `${thinking.length} 思考变体` : "–"}</span>
        <span style={{ fontSize: "11px", color: "#475569", marginLeft: "4px" }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: "5px", display: "flex", flexDirection: "column", gap: "3px" }}>
          {models.map((m) => (
            <div key={m.id} style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "7px", padding: "7px 12px",
            }}>
              <code style={{ fontFamily: "Menlo, monospace", fontSize: "12px", color: c.text, flex: 1, wordBreak: "break-all" }}>{m.id}</code>
              <span style={{ fontSize: "12px", color: "#475569", flexShrink: 0, minWidth: "100px", textAlign: "right" }}>{m.desc}</span>
              {m.context && (
                <span style={{ fontSize: "10px", color: "#334155", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "3px", padding: "1px 5px", flexShrink: 0 }}>{m.context}</span>
              )}
              {m.badge && <Badge variant={m.badge} />}
              <CopyButton text={m.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

function PageHome({
  displayUrl, apiKey, setApiKey, sillyTavernMode, stLoading, onToggleSTMode,
}: {
  displayUrl: string;
  apiKey: string;
  setApiKey: (k: string) => void;
  sillyTavernMode: boolean;
  stLoading: boolean;
  onToggleSTMode: () => void;
}) {
  return (
    <>
      {/* Changelog */}
      <Card style={{ marginBottom: "20px", borderColor: "rgba(99,102,241,0.25)", background: "rgba(99,102,241,0.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <span style={{ fontSize: "15px" }}>📋</span>
          <SectionTitle>更新日志 · Changelog</SectionTitle>
        </div>
        {(() => {
          const releases = [
            {
              version: "v1.1.2",
              date: "2026-04-07",
              items: [
                { zh: "配置助手重新设计：用户现在可以自行设定访问密码，密码明文写入发给 Agent 的指令中，Agent 直接配置，无需二次询问", en: "Setup wizard redesign: user sets their own access password; key is written directly into the Agent prompt — no random-generated key, no follow-up question" },
                { zh: "配置完成后门户首页「API Key」输入框自动填入用户设定的密码，无需手动复制", en: "Portal auto-fills the API Key field on wizard completion — user doesn't need to type their key a second time" },
                { zh: "用量统计通过 cloudPersist 持久化到存储（开发环境写本地文件，生产环境写对象存储）：服务器重启或重新部署后统计数据不丢失", en: "Usage stats now persisted via cloudPersist (local file in dev, object storage in prod) — survives restarts and Publish redeploys" },
                { zh: "认证失败提示语简化：密码由用户自定义，提示只需告知去 Secrets 面板查看或重新运行配置助手", en: "Auth error message simplified to match the new self-defined key flow" },
              ],
            },
            {
              version: "v1.1.1",
              date: "2026-04-07",
              items: [
                { zh: "流式超时从 120 秒提升到 600 秒（10 分钟），彻底解决长回复（≥5000 token）在传输途中被截断的问题", en: "Streaming fetch timeout raised from 120 s to 600 s — prevents truncation of long responses (5 000+ tokens)" },
                { zh: "SSE 保活间隔从每 3 秒改为每 15 秒，减少不必要带宽消耗，同时仍可防止代理 60 秒空闲超时", en: "SSE keepalive interval changed from 3 s to 15 s — less overhead while still preventing proxy idle timeouts" },
                { zh: "统计页「添加节点」区块新增 ENV 节点配置复制框：提示词内容直接可见，点击一键复制发给 Replit Agent", en: "Stats page: ENV node prompt is now displayed in a copyable block — no more hidden-behind-button UX" },
                { zh: "日志页面只展示最新一条更新，其余历史版本折叠进滚动栏，首页核心功能无需滚动即可看全", en: "Changelog now shows only the latest release by default; all older entries are in a scrollable history section" },
              ],
            },
            {
              version: "v1.1.0",
              date: "2026-04-06",
              items: [
                { zh: "子节点请求失败自动重试（最多 3 次）：5xx 和网络错误均会自动换一个健康节点重试，不返回错误给客户端", en: "Friend proxy auto-retry: up to 3 attempts, skipping failed nodes on 5xx or network errors — client sees a clean response" },
                { zh: "区分 HTTP 错误（5xx）与网络错误，精准标记节点不健康并决定是否重试", en: "FriendProxyHttpError distinguishes upstream 5xx from network/timeout errors for smarter retry decisions" },
                { zh: "流式请求改为首个 chunk 到达后再发 SSE 头，确保在 chunk 来临前仍可切换节点", en: "Streaming: SSE headers committed only after first chunk arrives, preserving the retry window" },
                { zh: "子节点未返回 usage 时按字符数自动估算 token 用量（≈4字符/token），统计页面不再显示 0", en: "Token fallback: estimate prompt + completion tokens from char count when sub-node omits usage field" },
              ],
            },
            {
              version: "v1.0.9",
              date: "2026-04-06",
              items: [
                { zh: "配置助手弹窗逻辑修复：改为查询服务器是否已设置 PROXY_API_KEY，只在未完成初始化时才自动弹出；配置完成后无论换浏览器或清缓存均不再弹出", en: "Setup wizard no longer auto-pops on every load; now queries server setup status — only shows when PROXY_API_KEY is not yet configured" },
                { zh: "更新方式改为「复制提示词给 Replit Agent」：点击版本徽标→「复制提示词」→粘贴到 Replit AI 对话框，由 Agent 自动拉取最新代码并重启", en: "Update flow changed to 'Copy prompt for Replit Agent': click version badge → copy prompt → paste in Replit AI chat; Agent handles pull + restart" },
                { zh: "修复用量统计「刷新」按钮被上方元素遮挡无法点击的问题（去除 marginTop: -16px）", en: "Fix: stats refresh button was overlapped and unclickable due to negative margin; now properly positioned" },
                { zh: "统计加载失败时区分错误类型：服务器未配置 PROXY_API_KEY（500）vs API Key 不正确（401），显示针对性提示", en: "Stats error messages now differentiate: 'PROXY_API_KEY not configured' (500) vs 'API Key mismatch' (401)" },
              ],
            },
            {
              version: "v1.0.8",
              date: "2026-04-06",
              items: [
                { zh: "节点管理：全选 / 多选现在覆盖所有子节点（含 ENV 节点），批量启用 / 禁用 / 移除；ENV 节点无移除按钮", en: "Node management: select-all / multi-select now covers all sub-nodes (incl. ENV nodes); batch enable / disable / remove; ENV nodes have no remove button" },
                { zh: "更新日志加入滚动：仅展示最新 2 条，历史记录通过滚动查看", en: "Changelog scrollable: only 2 latest entries shown by default; scroll to view history" },
                { zh: "配置助手第 3 步：开通 App Storage，fork 用户的子节点配置 publish 后不再丢失", en: "Setup wizard step 3: provision App Storage so fork users' sub-node configs survive redeploys" },
              ],
            },
            {
              version: "v1.0.7",
              date: "2026-04-06",
              items: [
                { zh: "修复子节点 / 禁用模型数据 publish 后丢失：改用 Replit 云端对象存储（GCS）持久化，重新部署不再清空", en: "Fix: dynamic backends and disabled models now persisted to GCS — data survives redeploys" },
                { zh: "修复「重新检测」按钮在错误状态下不可点击的问题；点击后显示 loading 旋转和完成提示", en: "Fix: 'Re-check' button is now always clickable even after an error; shows spinner and completion feedback" },
                { zh: "修复「检测更新」弹窗按钮在 error 状态重置流程；新增无更新时「已是最新版本」提示", en: "Fix update modal error-state reset flow; show 'Already up to date' notice when no update is available" },
                { zh: "统计页面：/v1/stats 现在包含全部后端节点（含禁用的），禁用节点以红色边框 + 「已禁用」标签区分", en: "Stats page: /v1/stats now includes all backends including disabled ones; disabled rows show red border + badge" },
              ],
            },
            {
              version: "v1.0.6",
              date: "2026-04-06",
              items: [
                { zh: "新增「模型管理」标签页：支持按组一键全部启用/禁用，或逐条切换每个模型的开关状态", en: "New 'Model Management' tab: group-level one-click enable/disable and per-model toggle switches" },
                { zh: "禁用的模型从 /v1/models 响应中过滤，调用时返回 403 错误（model_disabled）", en: "Disabled models are filtered from /v1/models and return 403 (model_disabled) when called" },
                { zh: "状态持久化到 disabled_models.json，重启后保留设置", en: "State persisted to disabled_models.json, survives server restarts" },
                { zh: "「立即更新」按钮恢复：一键从 GitHub 拉取最新代码 + 自动重启", en: "Restored one-click update button: pulls latest code from GitHub and auto-restarts" },
              ],
            },
            {
              version: "v1.0.5",
              date: "2026-04-06",
              items: [
                { zh: "配置助手重写：单步模式，一条指令完成所有初始化（Secret + AI Integrations + 重启），明确禁止 Agent 索取第三方 API Key", en: "SetupWizard rewrite: single-step prompt covers all init (Secret + AI Integrations + restart); forbids Agent from asking for third-party API keys" },
                { zh: "版本比较修复：正确处理预发布后缀（a/b/rc1 等），stable > 同号 pre-release", en: "Version comparison fix: correctly handles pre-release suffixes (a/b/rc1…); stable > same-number pre-release" },
                { zh: "子节点 URL 自动补全 /api 后缀（服务端路由层 + 前端统计页）", en: "Sub-node URL auto-normalization: auto-appends /api suffix in server routing and frontend Stats page" },
                { zh: "X-Proxy-Version header 修复：过滤非 ASCII 字符，彻底解决 ERR_INVALID_CHAR 崩溃", en: "X-Proxy-Version header fix: strip non-ASCII chars, eliminating ERR_INVALID_CHAR crash" },
                { zh: "后端批量管理：多选批量启用 / 禁用 / 删除", en: "Batch backend management: multi-select for bulk enable / disable / remove" },
              ],
            },
            {
              version: "v1.0.1",
              date: "2026-04-06",
              items: [
                { zh: "完整 tool calling 支持 — Claude、Gemini 自动格式互转（tool_use / functionDeclarations）", en: "Full tool calling support — auto-conversion for Claude (tool_use) and Gemini (functionDeclarations)" },
                { zh: "Claude 流式工具调用：input_json_delta 逐块转发，finish_reason 正确映射为 tool_calls", en: "Claude streaming tool calls: input_json_delta forwarded chunk-by-chunk with correct tool_calls finish_reason" },
                { zh: "前端三栏重构：首页 / 统计 & 节点 / 端点文档，布局更清晰", en: "Frontend redesigned into 3-tab layout: Home / Stats & Nodes / API Docs" },
                { zh: "新增 Fleet Manager — 子节点批量版本检测与一键更新", en: "New Fleet Manager — batch version check and one-click update for sub-nodes" },
              ],
            },
            {
              version: "v1.0.0",
              date: "2026-04-06",
              items: [
                { zh: "正式版发布 — 统一接入 OpenAI / Anthropic / Gemini / OpenRouter 四大后端", en: "Initial release — unified gateway for OpenAI / Anthropic / Gemini / OpenRouter" },
                { zh: "支持 SillyTavern 兼容模式、CherryStudio 接入、多种认证方式", en: "SillyTavern compatibility mode, CherryStudio integration, multiple auth methods" },
                { zh: "Replit 文件包热更新机制（无需 GitHub，跨实例推送）", en: "Replit file-bundle hot-update system (no GitHub required, cross-instance push)" },
              ],
            },
          ];

          const renderRelease = (release: typeof releases[0]) => (
            <div key={release.version} style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <span style={{ fontFamily: "Menlo, monospace", fontSize: "13px", fontWeight: 700, color: "#a5b4fc" }}>{release.version}</span>
                <span style={{ fontSize: "11px", color: "#334155" }}>{release.date}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", paddingLeft: "4px" }}>
                {release.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <span style={{ color: "#4f46e5", marginTop: "2px", flexShrink: 0, fontSize: "11px" }}>▸</span>
                    <div>
                      <div style={{ fontSize: "12.5px", color: "#94a3b8", lineHeight: "1.5" }}>{item.zh}</div>
                      <div style={{ fontSize: "11px", color: "#334155", lineHeight: "1.5", fontStyle: "italic" }}>{item.en}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );

          const VISIBLE = 1;
          const visible = releases.slice(0, VISIBLE);
          const older = releases.slice(VISIBLE);

          return (
            <>
              {visible.map(renderRelease)}
              {older.length > 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0 10px" }}>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                    <span style={{ fontSize: "10.5px", color: "#334155" }}>历史版本 ↓ 滚动查看</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
                  </div>
                  <div style={{ maxHeight: "200px", overflowY: "auto", paddingRight: "4px" }}>
                    {older.map(renderRelease)}
                  </div>
                </>
              )}
            </>
          );
        })()}
      </Card>

      {/* Feature Cards */}
      <div style={{ marginBottom: "20px" }}>
        <SectionTitle>核心功能</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px,1fr))", gap: "10px" }}>
          {[
            { icon: "🔀", title: "多后端路由", desc: "按模型名称自动路由到 OpenAI、Anthropic、Gemini 或 OpenRouter。", color: "#6366f1" },
            { icon: "📐", title: "多格式兼容", desc: "同时支持 OpenAI、Claude Messages、Gemini Native 三种请求格式，自动转换。", color: "#3b82f6" },
            { icon: "🔧", title: "工具 / 函数调用", desc: "完整支持 OpenAI tools + tool_calls，自动转换到各后端原生格式。", color: "#f59e0b" },
            { icon: "🧠", title: "扩展思考模式", desc: "Claude、Gemini、o-series 均支持 -thinking 和 -thinking-visible 后缀别名。", color: "#a855f7" },
            { icon: "🔑", title: "多种认证方式", desc: "支持 Bearer Token、x-goog-api-key 请求头、?key= URL 参数三种方式。", color: "#10b981" },
            { icon: "⚡", title: "流式输出 SSE", desc: "所有端点均支持 SSE 流式输出，包括 Claude 和 Gemini 原生格式端点。", color: "#f43f5e" },
          ].map((f) => (
            <div key={f.title} style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px", padding: "16px", borderTopColor: `${f.color}30`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <span style={{ fontSize: "18px", width: "32px", height: "32px", background: `${f.color}15`, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>{f.icon}</span>
                <span style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "13px" }}>{f.title}</span>
              </div>
              <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: "1.6" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Base URL */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>Base URL</SectionTitle>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <code style={{
            flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "8px", padding: "10px 16px", fontFamily: "Menlo, monospace",
            fontSize: "14px", color: "#a78bfa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{displayUrl}</code>
          <CopyButton text={displayUrl} label="复制 URL" />
        </div>
        <div style={{ marginTop: "10px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <span style={{
            fontSize: "10px", fontWeight: 700, color: "#fbbf24",
            background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: "4px", padding: "1px 6px", flexShrink: 0, marginTop: "1px",
          }}>DEV</span>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#475569", lineHeight: "1.6" }}>
            当前显示为开发预览地址。将本项目 <strong style={{ color: "#94a3b8" }}>Publish（发布）</strong> 后，请以生产环境域名（<code style={{ color: "#a78bfa", fontSize: "11.5px" }}>https://your-app.replit.app</code>）作为正式 Base URL 使用。
          </p>
        </div>
      </Card>

      {/* API Key + SillyTavern */}
      <Card>
        <SectionTitle>访问密码 & 设置</SectionTitle>
        <div style={{ marginBottom: "14px" }}>
          <label style={{ fontSize: "12px", color: "#64748b", display: "block", marginBottom: "6px" }}>API Key（PROXY_API_KEY）</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); localStorage.setItem("proxy_api_key", e.target.value); }}
            placeholder="输入你的 PROXY_API_KEY"
            style={{
              width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "8px", padding: "8px 12px", color: "#e2e8f0",
              fontFamily: "Menlo, monospace", fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "13.5px", marginBottom: "3px" }}>SillyTavern 兼容模式</div>
            <p style={{ margin: 0, color: "#475569", fontSize: "12.5px", lineHeight: "1.5" }}>
              启用后对 Claude 自动追加空 user 消息，修复角色顺序要求。
            </p>
          </div>
          <button
            onClick={onToggleSTMode}
            disabled={stLoading || !apiKey}
            style={{
              width: "52px", height: "28px", borderRadius: "14px", border: "none",
              background: sillyTavernMode ? "#6366f1" : "rgba(255,255,255,0.12)",
              cursor: (stLoading || !apiKey) ? "not-allowed" : "pointer",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
              opacity: (stLoading || !apiKey) ? 0.5 : 1,
            }}
          >
            <div style={{
              width: "22px", height: "22px", borderRadius: "50%", background: "#fff",
              position: "absolute", top: "3px", left: sillyTavernMode ? "27px" : "3px",
              transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            }} />
          </button>
        </div>
        <div style={{
          marginTop: "10px", padding: "7px 12px",
          background: sillyTavernMode ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${sillyTavernMode ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.06)"}`,
          borderRadius: "8px", fontSize: "12px",
          color: sillyTavernMode ? "#818cf8" : "#475569", fontWeight: 500, transition: "all 0.2s",
        }}>
          {sillyTavernMode ? '已启用 — 自动追加 {role:"user", content:"继续"} 给 Claude 模型' : "已禁用 — 消息原样发送"}
        </div>
      </Card>
    </>
  );
}

type BackendStat = { calls: number; errors: number; promptTokens: number; completionTokens: number; totalTokens: number; avgDurationMs: number; avgTtftMs: number | null; health: string; url?: string; dynamic?: boolean; enabled?: boolean };

function PageStats({
  baseUrl, apiKey, stats, statsError, onRefresh,
  addUrl, setAddUrl, addState, addMsg, onAddBackend, onRemoveBackend,
  onToggleBackend, onBatchToggle, onBatchRemove,
}: {
  baseUrl: string;
  apiKey: string;
  stats: Record<string, BackendStat> | null;
  statsError: false | "auth" | "server";
  onRefresh: () => void;
  addUrl: string;
  setAddUrl: (u: string) => void;
  addState: "idle" | "loading" | "ok" | "err";
  addMsg: string;
  onAddBackend: (e: React.FormEvent) => void;
  onRemoveBackend: (label: string) => void;
  onToggleBackend: (label: string, enabled: boolean) => void;
  onBatchToggle: (labels: string[], enabled: boolean) => void;
  onBatchRemove: (labels: string[]) => void;
}) {
  const _ = baseUrl; // used by parent
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [envPromptCopied, setEnvPromptCopied] = useState(false);

  const ENV_NODE_PROMPT =
    `请在当前 Replit 项目中添加一个环境变量，将子节点注册为永久 ENV 节点（Publish 后不会丢失）：\n\n` +
    `步骤 1：检查以下环境变量名，按顺序找到第一个尚未设置的空位：\n` +
    `   FRIEND_PROXY_URL → FRIEND_PROXY_URL_2 → FRIEND_PROXY_URL_3 → … → FRIEND_PROXY_URL_20\n` +
    `   （可在 Secrets 面板或 viewEnvVars() 中查看已占用的名称）\n\n` +
    `步骤 2：通过 Replit Secrets 面板为该空位添加 Secret，值填写子节点 Publish 后的站点地址：\n` +
    `   https://【填入你的子节点 Publish 后的站点】\n` +
    `   示例：https://my-proxy.replit.app\n\n` +
    `步骤 3：重启服务器（Shell 中执行重启，或点击 Replit Run 按钮）\n\n` +
    `说明：\n` +
    `• 地址只填根路径即可（无需加 /api），程序会自动补全\n` +
    `• 重启后该节点会立刻出现在统计页面，且 Publish 后仍然保留\n` +
    `• ENV 节点与动态节点共存，自动负载均衡`;

  const copyEnvPrompt = () => {
    navigator.clipboard.writeText(ENV_NODE_PROMPT).then(() => {
      setEnvPromptCopied(true);
      setTimeout(() => setEnvPromptCopied(false), 2000);
    });
  };

  // All sub-nodes (everything except "local")
  const allSubNodes = stats
    ? Object.entries(stats).filter(([l]) => l !== "local")
    : [];
  const dynamicNodes = allSubNodes.filter(([, s]) => s.dynamic);

  const allSelected = allSubNodes.length > 0 && allSubNodes.every(([l]) => selected.has(l));
  const someSelected = selected.size > 0;

  const toggleSelect = (label: string) =>
    setSelected((prev) => { const s = new Set(prev); s.has(label) ? s.delete(label) : s.add(label); return s; });

  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(allSubNodes.map(([l]) => l)));

  return (
    <>
      {/* Stats */}
      <Card style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <SectionTitle>用量统计</SectionTitle>
          <button onClick={onRefresh} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px", padding: "4px 10px", color: "#64748b", fontSize: "12px",
            cursor: "pointer",
          }}>刷新</button>
        </div>

        {!apiKey ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>请先在首页填入 API Key 后查看统计。</p>
        ) : statsError === "server" ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#f87171" }}>服务器未配置 PROXY_API_KEY — 请运行配置助手完成初始化。</p>
        ) : statsError === "auth" ? (
          <div style={{ fontSize: "13px", color: "#f87171", lineHeight: "1.7" }}>
            <div style={{ fontWeight: 600, marginBottom: "6px" }}>认证失败（API Key 不匹配）</div>
            <div style={{ color: "#94a3b8", fontSize: "12.5px" }}>
              首页填入的 API Key 需与配置时设定的密码完全一致。
            </div>
            <div style={{ color: "#475569", fontSize: "12px", marginTop: "6px" }}>
              如果忘记了密码，请在 Replit 左侧边栏 <strong style={{ color: "#94a3b8" }}>🔒 Secrets</strong> 面板中查看
              <code style={{ color: "#a78bfa", fontFamily: "Menlo, monospace", marginLeft: "4px" }}>PROXY_API_KEY</code>
              的值，也可以重新运行配置助手修改密码。
            </div>
          </div>
        ) : !stats ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>加载中...</p>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "16px" }}>
              {(() => {
                const total = Object.values(stats).reduce((acc, s) => ({
                  calls: acc.calls + s.calls,
                  tokens: acc.tokens + s.totalTokens,
                  errors: acc.errors + s.errors,
                }), { calls: 0, tokens: 0, errors: 0 });
                return [
                  { label: "总请求数", value: total.calls.toString(), color: "#818cf8" },
                  { label: "总 Tokens", value: `${(total.tokens / 1000).toFixed(1)}K`, color: "#34d399" },
                  { label: "错误数", value: total.errors.toString(), color: total.errors > 0 ? "#f87171" : "#4ade80" },
                ].map((s) => (
                  <div key={s.label} style={{
                    background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "10px", padding: "14px",
                  }}>
                    <div style={{ fontSize: "22px", fontWeight: 700, color: s.color, fontFamily: "Menlo, monospace" }}>{s.value}</div>
                    <div style={{ fontSize: "11px", color: "#475569", marginTop: "4px" }}>{s.label}</div>
                  </div>
                ));
              })()}
            </div>

            {/* Per-backend rows */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {Object.entries(stats).map(([label, s]) => {
                const isEnabled = s.enabled !== false;
                const isHealthy = s.health === "healthy";
                return (
                <div key={label} style={{
                  background: isEnabled ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.35)",
                  border: `1px solid ${isEnabled ? "rgba(255,255,255,0.06)" : "rgba(248,113,113,0.15)"}`,
                  borderRadius: "8px", padding: "12px 14px",
                  opacity: isEnabled ? 1 : 0.65,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <div style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: !isEnabled ? "#64748b" : isHealthy ? "#4ade80" : "#f87171",
                      boxShadow: (isEnabled && isHealthy) ? "0 0 5px #4ade80" : undefined,
                      flexShrink: 0,
                    }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: isEnabled ? "#94a3b8" : "#475569", fontFamily: "Menlo, monospace" }}>{label}</span>
                    {s.dynamic && <span style={{ fontSize: "10px", color: "#a78bfa", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "4px", padding: "1px 5px" }}>动态</span>}
                    {!isEnabled && <span style={{ fontSize: "10px", color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: "4px", padding: "1px 5px" }}>已禁用</span>}
                    {s.url && <span style={{ fontSize: "11px", color: "#334155", fontFamily: "Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.url}</span>}
                  </div>
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    {[
                      { label: "请求", value: s.calls },
                      { label: "错误", value: s.errors, color: s.errors > 0 ? "#f87171" : undefined },
                      { label: "Prompt", value: `${(s.promptTokens / 1000).toFixed(1)}K` },
                      { label: "输出", value: `${(s.completionTokens / 1000).toFixed(1)}K` },
                      { label: "总 Token", value: `${(s.totalTokens / 1000).toFixed(1)}K` },
                      { label: "均耗时", value: `${s.avgDurationMs}ms` },
                      ...(s.avgTtftMs ? [{ label: "首 Token", value: `${s.avgTtftMs}ms` }] : []),
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "10px", color: "#475569" }}>{item.label}</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: (item as { color?: string }).color ?? "#cbd5e1", fontFamily: "Menlo, monospace" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Add Node */}
      <Card>
        <SectionTitle>添加节点</SectionTitle>
        <p style={{ margin: "0 0 12px", fontSize: "12.5px", color: "#475569" }}>即时生效，无需重启或重新发布。节点间自动负载均衡。</p>

        {!apiKey ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>请先在首页填入 API Key 后操作。</p>
        ) : (
          <>
            <form onSubmit={onAddBackend} style={{ display: "flex", gap: "8px" }}>
              <input
                type="url"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                placeholder="https://friend-proxy.replit.app"
                style={{
                  flex: 1, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px", padding: "8px 12px", color: "#e2e8f0",
                  fontFamily: "Menlo, monospace", fontSize: "13px", outline: "none",
                }}
              />
              <button type="submit" disabled={addState === "loading"} style={{
                background: addState === "loading" ? "rgba(99,102,241,0.4)" : "rgba(99,102,241,0.7)",
                border: "1px solid rgba(99,102,241,0.6)", color: "#e0e7ff",
                borderRadius: "8px", padding: "8px 18px", fontSize: "13px",
                fontWeight: 600, cursor: addState === "loading" ? "not-allowed" : "pointer",
                flexShrink: 0,
              }}>{addState === "loading" ? "添加中…" : "添加节点"}</button>
            </form>

            {/* ENV node via Replit Agent */}
            <div style={{ marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "14px" }}>
              <div style={{ fontSize: "12.5px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>
                通过环境变量添加（永久节点）
              </div>
              <div style={{ fontSize: "11.5px", color: "#475569", lineHeight: "1.5", marginBottom: "8px" }}>
                ENV 节点写入 Secrets，Publish 后不会丢失。将下方内容发给 Replit Agent 即可自动完成配置。
              </div>
              {/* Copyable prompt block */}
              <div
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(99,102,241,0.3)",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    color: "#a5b4fc",
                    fontSize: "12px",
                    fontFamily: "Menlo, Consolas, monospace",
                    lineHeight: "1.6",
                    whiteSpace: "pre-wrap",
                    userSelect: "all",
                    wordBreak: "break-all",
                  }}
                >
                  {ENV_NODE_PROMPT}
                </span>
                <button
                  onClick={copyEnvPrompt}
                  title="复制"
                  style={{
                    flexShrink: 0,
                    background: envPromptCopied ? "rgba(74,222,128,0.12)" : "rgba(99,102,241,0.1)",
                    border: `1px solid ${envPromptCopied ? "rgba(74,222,128,0.4)" : "rgba(99,102,241,0.25)"}`,
                    borderRadius: "6px",
                    padding: "4px 10px",
                    color: envPromptCopied ? "#4ade80" : "#a78bfa",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {envPromptCopied ? "✓ 已复制" : "📋 复制"}
                </button>
              </div>
            </div>
            {(() => {
              const raw = addUrl.trim();
              const normed = normalizeBackendUrl(raw);
              return raw && normed !== raw.replace(/\/+$/, "") ? (
                <p style={{ margin: "6px 0 0", fontSize: "11.5px", color: "#94a3b8" }}>
                  将保存为：<code style={{ color: "#a78bfa", fontFamily: "Menlo, monospace" }}>{normed}</code>
                </p>
              ) : null;
            })()}
            {addState === "ok" && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#4ade80" }}>{addMsg}</p>}
            {addState === "err" && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#f87171" }}>{addMsg}</p>}

            {allSubNodes.length > 0 && (
              <div style={{ marginTop: "14px" }}>
                {/* 标题行 + 全选 + 批量操作 */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                  {/* 全选复选框 */}
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                      onChange={toggleSelectAll}
                      style={{ accentColor: "#818cf8", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "11px", color: "#475569" }}>
                      {allSelected ? "取消全选" : "全选"}
                      {someSelected && !allSelected ? `（已选 ${selected.size} / ${allSubNodes.length}）` : `（共 ${allSubNodes.length} 个节点）`}
                    </span>
                  </label>

                  {/* 批量操作按钮（有选中时显示） */}
                  {someSelected && (
                    <>
                      <button
                        onClick={() => { onBatchToggle([...selected], true); setSelected(new Set()); }}
                        style={{ padding: "2px 10px", borderRadius: "5px", fontSize: "11px", border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)", color: "#4ade80", cursor: "pointer" }}
                      >启用选中</button>
                      <button
                        onClick={() => { onBatchToggle([...selected], false); setSelected(new Set()); }}
                        style={{ padding: "2px 10px", borderRadius: "5px", fontSize: "11px", border: "1px solid rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.08)", color: "#fbbf24", cursor: "pointer" }}
                      >禁用选中</button>
                      {/* 移除仅针对动态节点 */}
                      {[...selected].some((l) => dynamicNodes.find(([dl]) => dl === l)) && (
                        <button
                          onClick={() => {
                            const dynamicSelected = [...selected].filter((l) => dynamicNodes.find(([dl]) => dl === l));
                            onBatchRemove(dynamicSelected);
                            setSelected(new Set());
                          }}
                          style={{ padding: "2px 10px", borderRadius: "5px", fontSize: "11px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: "pointer" }}
                        >移除动态节点</button>
                      )}
                    </>
                  )}
                </div>

                {/* 节点列表 */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {allSubNodes.map(([label, s]) => {
                    const isEnabled = s.enabled !== false;
                    const isChecked = selected.has(label);
                    const isDynamic = !!s.dynamic;
                    return (
                      <div
                        key={label}
                        onClick={() => toggleSelect(label)}
                        style={{
                          display: "flex", alignItems: "center", gap: "8px",
                          background: isChecked ? "rgba(99,102,241,0.1)" : "rgba(0,0,0,0.2)",
                          border: `1px solid ${isChecked ? "rgba(99,102,241,0.35)" : "rgba(255,255,255,0.05)"}`,
                          borderRadius: "7px", padding: "8px 12px",
                          cursor: "pointer", transition: "all 0.15s",
                          opacity: isEnabled ? 1 : 0.5,
                        }}
                      >
                        {/* 复选框 */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(label)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ accentColor: "#818cf8", width: "14px", height: "14px", cursor: "pointer", flexShrink: 0 }}
                        />

                        {/* 健康状态点 */}
                        <div style={{ width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                          background: isEnabled ? (s.health === "healthy" ? "#4ade80" : "#f87171") : "#475569" }} />

                        {/* 类型标签 */}
                        {!isDynamic && (
                          <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", borderRadius: "4px", padding: "1px 5px", flexShrink: 0 }}>ENV</span>
                        )}

                        {/* URL / label */}
                        <span style={{ flex: 1, fontSize: "12px", color: isEnabled ? "#94a3b8" : "#475569", fontFamily: "Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {s.url ?? label}
                        </span>

                        {/* 禁用标签 */}
                        {!isEnabled && (
                          <span style={{ fontSize: "10px", color: "#64748b", background: "rgba(100,116,139,0.15)", border: "1px solid rgba(100,116,139,0.3)", borderRadius: "4px", padding: "1px 6px", flexShrink: 0 }}>已禁用</span>
                        )}

                        <span style={{ fontSize: "11px", color: "#475569", flexShrink: 0 }}>{s.calls} 次</span>

                        {/* 单个启用/禁用 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); onToggleBackend(label, !isEnabled); }}
                          style={{ background: "none", border: `1px solid ${isEnabled ? "rgba(251,191,36,0.3)" : "rgba(74,222,128,0.3)"}`, borderRadius: "4px", color: isEnabled ? "#fbbf24" : "#4ade80", fontSize: "11px", cursor: "pointer", padding: "1px 7px", flexShrink: 0 }}
                        >
                          {isEnabled ? "禁用" : "启用"}
                        </button>

                        {/* 移除仅动态节点可用 */}
                        {isDynamic && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onRemoveBackend(label); }}
                            style={{ background: "none", border: "none", color: "#f87171", fontSize: "13px", cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}
                          >×</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <FleetManager />
    </>
  );
}

// ---------------------------------------------------------------------------
// UpdateBar — 全局顶部更新通知条（自动检测，有更新时展示）
// ---------------------------------------------------------------------------

function UpdateBar({ baseUrl, apiKey: _apiKey }: { baseUrl: string; apiKey: string }) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [latestVer, setLatestVer] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/api/update/version`);
      if (!r.ok) return;
      const d = await r.json();
      setHasUpdate(!!d.hasUpdate);
      setLatestVer(d.latestVersion ?? "");
      setReleaseNotes(d.latestReleaseNotes ?? "");
    } catch {}
  }, [baseUrl]);

  useEffect(() => {
    check();
    const t = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [check]);

  const buildPrompt = (ver: string) =>
    `请帮我把 AI 网关更新到最新版本 ${ver}。\n` +
    `从 GitHub 仓库 https://github.com/Akatsuki03/Replit2Api 拉取最新代码，覆盖当前项目文件（无需保留原文件），` +
    `然后运行 pnpm install，最后重启 "artifacts/api-server: API Server" 和 "artifacts/api-portal: web" 两个工作流。`;

  const copyPrompt = async () => {
    const text = buildPrompt(latestVer);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const recheck = async () => {
    setChecking(true);
    await check();
    setChecking(false);
  };

  if (dismissed || !hasUpdate) return null;

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 1000,
      background: "rgba(251,191,36,0.1)",
      borderBottom: "1px solid rgba(251,191,36,0.3)",
      backdropFilter: "blur(12px)",
    }}>
      <div style={{
        maxWidth: "900px", margin: "0 auto", padding: "10px 24px",
        display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap",
      }}>
        <span style={{ fontSize: "16px", flexShrink: 0 }}>🎉</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "13px", color: "#fbbf24" }}>
            <strong>发现新版本 v{latestVer}</strong>
            {releaseNotes && <span style={{ color: "#92400e", marginLeft: "10px", fontSize: "12px" }}>{releaseNotes}</span>}
          </span>
        </div>

        {/* 复制提示词 — 粘贴给 Replit Agent 完成更新 */}
        <button
          onClick={copyPrompt}
          style={{
            padding: "5px 14px", borderRadius: "7px", fontSize: "12.5px", fontWeight: 700,
            border: `1px solid ${copied ? "rgba(74,222,128,0.5)" : "rgba(251,191,36,0.5)"}`,
            background: copied ? "rgba(74,222,128,0.15)" : "rgba(251,191,36,0.18)",
            color: copied ? "#4ade80" : "#fbbf24",
            cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
          }}
        >
          {copied ? "✓ 已复制！粘贴给 Agent" : "📋 复制更新提示词"}
        </button>

        <button
          onClick={recheck}
          disabled={checking}
          style={{
            padding: "5px 10px", borderRadius: "7px", fontSize: "12px",
            border: "1px solid rgba(251,191,36,0.25)",
            background: "transparent", color: "#92400e",
            cursor: checking ? "not-allowed" : "pointer", flexShrink: 0,
            opacity: checking ? 0.5 : 1,
          }}
        >
          {checking ? "检测中…" : "重新检测"}
        </button>

        <button
          onClick={() => setDismissed(true)}
          style={{ background: "none", border: "none", color: "#92400e", fontSize: "18px", cursor: "pointer", flexShrink: 0, lineHeight: 1 }}
        >×</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fleet Manager
// 上游版本检测地址改为 GitHub raw，子节点从 GitHub 拉取更新，无需上游 Replit 在线
// ---------------------------------------------------------------------------

const _UPSTREAM_VER_URL = "https://raw.githubusercontent.com/Akatsuki03/Replit2Api/main/version.json";

interface FleetInstance {
  id: string;
  name: string;
  url: string;
  key: string;
  status: "unknown" | "checking" | "ok" | "updating" | "error" | "restarting";
  version: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: number | null;
  updateLog: string | null;
}

const FLEET_STORE_KEY = "fleet_instances_v2";

function loadFleet(): FleetInstance[] {
  try { return JSON.parse(localStorage.getItem(FLEET_STORE_KEY) ?? "[]") as FleetInstance[]; }
  catch { return []; }
}
function saveFleet(data: FleetInstance[]) {
  localStorage.setItem(FLEET_STORE_KEY, JSON.stringify(data));
}
function genId() { return Math.random().toString(36).slice(2, 9); }

// Normalize user-supplied URL to the correct backend endpoint.
// Expected format: https://{project}.replit.app/api
function normalizeBackendUrl(raw: string): string {
  const url = raw.trim().replace(/\/+$/, "");
  if (!url) return url;
  return /\/api$/i.test(url) ? url : url + "/api";
}

function FleetManager() {
  const [instances, setInstances] = useState<FleetInstance[]>(() => loadFleet());
  const [addName, setAddName] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addKey, setAddKey] = useState("");
  const [logTarget, setLogTarget] = useState<string | null>(null);

  const persist = (next: FleetInstance[]) => { setInstances(next); saveFleet(next); };

  const addInst = () => {
    const url = addUrl.trim().replace(/\/+$/, "");
    const key = addKey.trim();
    if (!url || !key) return;
    const inst: FleetInstance = {
      id: genId(), name: addName.trim() || url, url, key,
      status: "unknown", version: null, latestVersion: null,
      updateAvailable: false, lastChecked: null, updateLog: null,
    };
    const next = [...instances, inst];
    persist(next);
    setAddName(""); setAddUrl(""); setAddKey("");
  };

  const removeInst = (id: string) => persist(instances.filter((i) => i.id !== id));

  const patchInst = (id: string, patch: Partial<FleetInstance>) => {
    const next = instances.map((i) => i.id === id ? { ...i, ...patch } : i);
    persist(next); return next;
  };

  const checkOne = async (id: string) => {
    const inst = instances.find((i) => i.id === id);
    if (!inst) return;
    patchInst(id, { status: "checking" });
    try {
      const r = await fetch(`${inst.url}/api/update/version`, {
        headers: { Authorization: `Bearer ${inst.key}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { version?: string; hasUpdate?: boolean; latestVersion?: string };
      patchInst(id, {
        status: "ok",
        version: d.version ?? null,
        latestVersion: d.latestVersion ?? null,
        updateAvailable: d.hasUpdate ?? false,
        lastChecked: Date.now(),
      });
    } catch {
      patchInst(id, { status: "error", lastChecked: Date.now() });
    }
  };

  const checkAll = async () => {
    await Promise.all(instances.map((i) => checkOne(i.id)));
  };

  const updateOne = async (id: string) => {
    const inst = instances.find((i) => i.id === id);
    if (!inst) return;
    patchInst(id, { status: "updating", updateLog: null });
    try {
      const r = await fetch(`${inst.url}/api/update/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${inst.key}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
      });
      const d = await r.json() as { status?: string; message?: string };
      const logMsg = d.message ?? (r.ok ? "更新指令已发送，服务器将自动重启。" : "更新请求失败。");
      patchInst(id, {
        status: r.ok ? "restarting" : "error",
        updateLog: logMsg,
        lastChecked: Date.now(),
      });
      setLogTarget(id);
    } catch (e) {
      patchInst(id, { status: "error", updateLog: `错误: ${(e as Error).message}`, lastChecked: Date.now() });
      setLogTarget(id);
    }
  };

  const updateAll = async () => {
    const toUpdate = instances.filter((i) => i.updateAvailable);
    if (!toUpdate.length) return;
    for (const inst of toUpdate) await updateOne(inst.id);
  };

  const exportJson = () => {
    const data = instances.map(({ name, url, key }) => ({ name, url, key }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fleet.json";
    a.click();
  };

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json,application/json";
    input.onchange = async (e) => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const arr = JSON.parse(await file.text()) as Array<{ name?: string; url?: string; key?: string }>;
        let added = 0;
        const next = [...instances];
        for (const item of arr) {
          if (!item.url || !item.key) continue;
          if (next.some((i) => i.url === item.url)) continue;
          next.push({
            id: genId(), name: item.name || item.url,
            url: item.url.replace(/\/+$/, ""), key: item.key,
            status: "unknown", version: null, latestVersion: null,
            updateAvailable: false, lastChecked: null, updateLog: null,
          });
          added++;
        }
        persist(next);
        if (added === 0) alert("没有新节点被导入（URL 重复或格式错误）");
      } catch (err) { alert(`导入失败: ${(err as Error).message}`); }
    };
    input.click();
  };

  const statusTag = (inst: FleetInstance) => {
    if (inst.status === "checking") return { label: "检测中", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" };
    if (inst.status === "updating") return { label: "更新中", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
    if (inst.status === "restarting") return { label: "重启中", color: "#818cf8", bg: "rgba(129,140,248,0.12)" };
    if (inst.status === "error") return { label: "连接失败", color: "#f87171", bg: "rgba(248,113,113,0.12)" };
    if (inst.status === "ok") {
      if (inst.updateAvailable) return { label: `有新版本 v${inst.latestVersion ?? ""}`, color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
      return { label: "已是最新", color: "#4ade80", bg: "rgba(74,222,128,0.12)" };
    }
    return { label: "未检测", color: "#475569", bg: "rgba(71,85,105,0.12)" };
  };

  const hasUpdates = instances.some((i) => i.updateAvailable);
  const logInst = instances.find((i) => i.id === logTarget);

  const inp: React.CSSProperties = {
    background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "7px", padding: "7px 11px", color: "#e2e8f0",
    fontFamily: "Menlo, monospace", fontSize: "12.5px", outline: "none",
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <SectionTitle>子节点管理</SectionTitle>
        <div style={{ display: "flex", gap: "6px", marginTop: "-16px" }}>
          <button onClick={importJson} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#64748b", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>导入 JSON</button>
          <button onClick={exportJson} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#64748b", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>导出 JSON</button>
          <button onClick={checkAll} disabled={instances.length === 0} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "#94a3b8", fontSize: "11px", padding: "4px 10px", cursor: "pointer" }}>全部检测</button>
          {hasUpdates && (
            <button onClick={updateAll} style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", borderRadius: "6px", color: "#fbbf24", fontSize: "11px", padding: "4px 10px", cursor: "pointer", fontWeight: 600 }}>全部更新</button>
          )}
        </div>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: "12.5px", color: "#475569" }}>管理多个部署实例 · 数据保存在本地浏览器</p>

      {/* Add form */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "0 0 110px" }} placeholder="名称" value={addName} onChange={(e) => setAddName(e.target.value)} />
          <input style={{ ...inp, flex: "2 1 180px" }} placeholder="https://your-proxy.replit.app（根地址）" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} />
          <input type="password" style={{ ...inp, flex: "1 1 130px" }} placeholder="PROXY_API_KEY" value={addKey} onChange={(e) => setAddKey(e.target.value)} />
          <button onClick={addInst} disabled={!addUrl || !addKey} style={{
            background: "rgba(99,102,241,0.7)", border: "1px solid rgba(99,102,241,0.6)",
            color: "#e0e7ff", borderRadius: "7px", padding: "7px 16px",
            fontSize: "13px", fontWeight: 600, cursor: (!addUrl || !addKey) ? "not-allowed" : "pointer",
            opacity: (!addUrl || !addKey) ? 0.5 : 1, flexShrink: 0,
          }}>添加</button>
        </div>
      </div>

      {/* Table */}
      {instances.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "#334155", fontSize: "13px" }}>暂无节点，请在上方添加</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {instances.map((inst) => {
            const tag = statusTag(inst);
            const busy = inst.status === "checking" || inst.status === "updating";
            const timeStr = inst.lastChecked ? new Date(inst.lastChecked).toLocaleTimeString() : null;
            return (
              <div key={inst.id} style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "9px", padding: "11px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  {/* Dot */}
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: tag.color, flexShrink: 0 }} />
                  {/* Name */}
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#cbd5e1", minWidth: "80px" }}>{inst.name}</span>
                  {/* URL (truncated) */}
                  <span style={{ fontSize: "11px", color: "#334155", fontFamily: "Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, maxWidth: "240px" }}>{inst.url}</span>
                  {/* Version */}
                  {inst.version && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "Menlo, monospace", flexShrink: 0 }}>v{inst.version}</span>
                  )}
                  {/* Status badge */}
                  <span style={{ fontSize: "11px", fontWeight: 600, color: tag.color, background: tag.bg, borderRadius: "99px", padding: "2px 9px", flexShrink: 0 }}>{tag.label}</span>
                  {/* Time */}
                  {timeStr && <span style={{ fontSize: "10px", color: "#334155", flexShrink: 0 }}>{timeStr}</span>}
                  {/* Actions */}
                  <div style={{ display: "flex", gap: "5px", flexShrink: 0, marginLeft: "auto" }}>
                    <button onClick={() => checkOne(inst.id)} disabled={busy} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#94a3b8", fontSize: "11px", padding: "3px 9px", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.4 : 1 }}>检测</button>
                    <button onClick={() => updateOne(inst.id)} disabled={busy} style={{ background: inst.updateAvailable ? "rgba(251,191,36,0.12)" : "none", border: `1px solid ${inst.updateAvailable ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.1)"}`, borderRadius: "5px", color: inst.updateAvailable ? "#fbbf24" : "#64748b", fontSize: "11px", padding: "3px 9px", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.4 : 1 }}>更新</button>
                    {inst.updateLog && (
                      <button onClick={() => setLogTarget(logTarget === inst.id ? null : inst.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "5px", color: "#475569", fontSize: "11px", padding: "3px 9px", cursor: "pointer" }}>日志</button>
                    )}
                    <button onClick={() => removeInst(inst.id)} style={{ background: "none", border: "1px solid rgba(248,113,113,0.3)", borderRadius: "5px", color: "#f87171", fontSize: "11px", padding: "3px 9px", cursor: "pointer" }}>删除</button>
                  </div>
                </div>
                {/* Log */}
                {logTarget === inst.id && logInst?.updateLog && (
                  <div style={{ marginTop: "10px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "6px", padding: "10px 14px", fontFamily: "Menlo, monospace", fontSize: "12px", color: "#4ade80", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {logInst.updateLog}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function PageEndpoints({ displayUrl, expandedGroups, onToggleGroup, totalModels }: {
  displayUrl: string;
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (g: string) => void;
  totalModels: number;
}) {
  return (
    <>
      {/* Endpoint list */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>API 端点列表</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {([
            { method: "GET", path: "/v1/models", desc: "列出所有可用模型" },
            { method: "POST", path: "/v1/chat/completions", desc: "OpenAI 格式补全（支持工具调用 + 流式）" },
            { method: "POST", path: "/v1/messages", desc: "Claude Messages 原生格式（所有后端均支持）" },
            { method: "POST", path: "/v1/models/:model:generateContent", desc: "Gemini 原生格式（非流式）" },
            { method: "POST", path: "/v1/models/:model:streamGenerateContent", desc: "Gemini 原生格式（流式 SSE）" },
            { method: "GET", path: "/v1/stats", desc: "查看各后端用量统计（需 API Key）" },
            { method: "GET", path: "/v1/admin/backends", desc: "列出所有后端节点（需 API Key）" },
            { method: "POST", path: "/v1/admin/backends", desc: "动态添加新节点（需 API Key）" },
            { method: "DELETE", path: "/v1/admin/backends/:label", desc: "移除动态节点（需 API Key）" },
          ] as { method: "GET" | "POST" | "DELETE"; path: string; desc: string }[]).map((ep) => (
            <div key={`${ep.method}:${ep.path}`} style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px", padding: "10px 14px",
            }}>
              <MethodBadge method={ep.method as "GET" | "POST"} />
              <code style={{ color: "#e2e8f0", fontFamily: "Menlo, monospace", fontSize: "12.5px", flex: 1 }}>{ep.path}</code>
              <span style={{ color: "#475569", fontSize: "12px", flexShrink: 0, maxWidth: "260px", textAlign: "right" }}>{ep.desc}</span>
              <CopyButton text={`${displayUrl}${ep.path}`} />
            </div>
          ))}
        </div>
      </Card>

      {/* Auth */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>认证方式（三选一）</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[
            { label: "Bearer Token（推荐，兼容所有 OpenAI 客户端）", code: `Authorization: Bearer YOUR_PROXY_API_KEY` },
            { label: "x-goog-api-key Header（兼容 Gemini 格式客户端）", code: `x-goog-api-key: YOUR_PROXY_API_KEY` },
            { label: "URL 查询参数（适合简单调试）", code: `${displayUrl}/v1/models?key=YOUR_PROXY_API_KEY` },
          ].map((auth) => (
            <div key={auth.label}>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "4px" }}>{auth.label}</div>
              <CodeBlock code={auth.code} />
            </div>
          ))}
        </div>
      </Card>

      {/* Tool Calling */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>工具 / 函数调用示例</SectionTitle>
        <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: "13px", lineHeight: "1.6" }}>
          使用 OpenAI 标准 <code style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "1px 5px", borderRadius: "4px" }}>tools</code> 格式，代理自动转换到各后端格式。
        </p>
        <CodeBlock
          code={`curl ${displayUrl}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4.1-mini",
    "messages": [{"role": "user", "content": "北京天气怎么样?"}],
    "tools": [{
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get weather for a city",
        "parameters": {
          "type": "object",
          "properties": { "city": {"type": "string"} },
          "required": ["city"]
        }
      }
    }],
    "tool_choice": "auto"
  }'`}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
          {["OpenAI ✓ pass-through", "Anthropic ✓ tool_use 转换", "Gemini ✓ functionDeclarations 转换", "OpenRouter ✓ pass-through"].map((s) => (
            <span key={s} style={{
              fontSize: "11px", color: "#4ade80", background: "rgba(74,222,128,0.08)",
              border: "1px solid rgba(74,222,128,0.2)", borderRadius: "5px", padding: "3px 8px",
            }}>{s}</span>
          ))}
        </div>
      </Card>

      {/* Quick Test */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>快速测试</SectionTitle>
        <CodeBlock
          code={`curl ${displayUrl}/v1/models \\
  -H "Authorization: Bearer YOUR_PROXY_API_KEY"`}
          copyText={`curl ${displayUrl}/v1/models \\\n  -H "Authorization: Bearer YOUR_PROXY_API_KEY"`}
        />
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "8px" }}>流式输出测试：</div>
          <CodeBlock
            code={`curl ${displayUrl}/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_PROXY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"gpt-4.1-mini","messages":[{"role":"user","content":"Hello!"}],"stream":true}'`}
          />
        </div>
      </Card>

      {/* Models */}
      <Card style={{ marginBottom: "14px" }}>
        <SectionTitle>可用模型（{totalModels} 个）</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
          {(["thinking", "thinking-visible", "tools", "reasoning"] as const).map((v) => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Badge variant={v} />
              <span style={{ fontSize: "11px", color: "#475569" }}>
                {v === "thinking" ? "扩展思考（隐藏）" : v === "thinking-visible" ? "扩展思考（可见）" : v === "tools" ? "支持工具调用" : "原生推理"}
              </span>
            </div>
          ))}
        </div>
        <ModelGroup title="OpenAI" models={OPENAI_MODELS} provider="openai" expanded={expandedGroups.openai} onToggle={() => onToggleGroup("openai")} />
        <ModelGroup title="Anthropic Claude" models={ANTHROPIC_MODELS} provider="anthropic" expanded={expandedGroups.anthropic} onToggle={() => onToggleGroup("anthropic")} />
        <ModelGroup title="Google Gemini" models={GEMINI_MODELS} provider="gemini" expanded={expandedGroups.gemini} onToggle={() => onToggleGroup("gemini")} />
        <ModelGroup title="OpenRouter（任意 provider/model 均可路由）" models={OPENROUTER_MODELS} provider="openrouter" expanded={expandedGroups.openrouter} onToggle={() => onToggleGroup("openrouter")} />
        <p style={{ margin: "10px 0 0", fontSize: "12px", color: "#334155", lineHeight: "1.5" }}>
          💡 任何包含 <code style={{ color: "#a78bfa" }}>/</code> 的模型名均自动路由到 OpenRouter，不限于上方列表。
        </p>
      </Card>

      {/* CherryStudio Guide */}
      <Card>
        <SectionTitle>CherryStudio 接入指南</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {[
            { step: 1, title: "打开设置 → 模型服务商", desc: "在 CherryStudio 中，点击左侧设置，选择「模型服务商」。" },
            { step: 2, title: "新增服务商，类型选「OpenAI Compatible」", desc: "点击「添加服务商」，类型选「OpenAI 兼容」（不要选 OpenAI 原生）。" },
            {
              step: 3, title: "填写 Base URL 和 API Key",
              desc: (
                <span>
                  Base URL 填入生产环境域名，API Key 填入 <code style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "1px 5px", borderRadius: "4px" }}>PROXY_API_KEY</code>。
                  <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#475569", flexShrink: 0 }}>当前地址</span>
                    <code style={{ flex: 1, color: "#a78bfa", fontSize: "12px", fontFamily: "Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{displayUrl}</code>
                    <CopyButton text={displayUrl} />
                  </div>
                </span>
              ),
            },
            { step: 4, title: "点击「检测」或「添加模型」", desc: `CherryStudio 会自动调用 /v1/models 加载 ${totalModels} 个模型列表，选择需要的模型即可开始使用。` },
          ].map((item) => (
            <div key={item.step} style={{ display: "flex", gap: "14px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, color: "#818cf8", flexShrink: 0, marginTop: "1px",
              }}>{item.step}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "#cbd5e1", fontSize: "14px", marginBottom: "4px" }}>{item.title}</div>
                <div style={{ color: "#475569", fontSize: "13px", lineHeight: "1.5" }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

// ---------------------------------------------------------------------------
// PageModels — model enable/disable management
// ---------------------------------------------------------------------------

interface ModelStatus { id: string; provider: string; enabled: boolean }

type GroupSummary = { total: number; enabled: number };

function ModelToggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: "36px", height: "20px", borderRadius: "10px", border: "none",
        background: enabled ? "rgba(99,102,241,0.7)" : "rgba(100,116,139,0.3)",
        position: "relative", cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
        padding: 0,
      }}
    >
      <div style={{
        width: "14px", height: "14px", borderRadius: "50%", background: "#fff",
        position: "absolute", top: "3px",
        left: enabled ? "19px" : "3px",
        transition: "left 0.15s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
      }} />
    </button>
  );
}

function PageModels({
  baseUrl, apiKey, modelStatus, summary, onRefresh, onToggleProvider, onToggleModel,
}: {
  baseUrl: string;
  apiKey: string;
  modelStatus: ModelStatus[];
  summary: Record<string, GroupSummary>;
  onRefresh: () => void;
  onToggleProvider: (provider: string, enabled: boolean) => void;
  onToggleModel: (id: string, enabled: boolean) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    openai: true, anthropic: true, gemini: true, openrouter: true,
  });
  const [filter, setFilter] = useState<"all" | "enabled" | "disabled">("all");

  const allGroups: { key: string; title: string; models: ModelEntry[]; provider: Provider }[] = [
    { key: "openai", title: "OpenAI", models: OPENAI_MODELS, provider: "openai" },
    { key: "anthropic", title: "Anthropic Claude", models: ANTHROPIC_MODELS, provider: "anthropic" },
    { key: "gemini", title: "Google Gemini", models: GEMINI_MODELS, provider: "gemini" },
    { key: "openrouter", title: "OpenRouter", models: OPENROUTER_MODELS, provider: "openrouter" },
  ];

  const statusMap = new Map(modelStatus.map((m) => [m.id, m.enabled]));

  const totalEnabled = modelStatus.filter((m) => m.enabled).length;
  const totalCount = modelStatus.length;

  if (!apiKey) {
    return (
      <Card>
        <div style={{ textAlign: "center", color: "#475569", padding: "40px 0" }}>
          <div style={{ fontSize: "24px", marginBottom: "12px" }}>🔒</div>
          <div>请先在首页填写 API Key 才能管理模型开关</div>
        </div>
      </Card>
    );
  }

  return (
    <>
      {/* 顶部统计行 */}
      <Card style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <SectionTitle>模型开关管理</SectionTitle>
          <div style={{ fontSize: "13px", color: "#475569" }}>
            已启用 <span style={{ color: "#a5b4fc", fontWeight: 700 }}>{totalEnabled}</span> / {totalCount} 个模型
            · 禁用的模型不会出现在 <code style={{ fontFamily: "Menlo, monospace", fontSize: "12px", color: "#818cf8" }}>/v1/models</code> 响应中，调用时返回 403
          </div>
        </div>
        {/* 过滤器 */}
        <div style={{ display: "flex", gap: "4px" }}>
          {(["all", "enabled", "disabled"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: "5px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)",
              background: filter === f ? "rgba(99,102,241,0.2)" : "transparent",
              color: filter === f ? "#a5b4fc" : "#475569", fontSize: "12px", cursor: "pointer",
              fontWeight: filter === f ? 600 : 400,
            }}>
              {f === "all" ? "全部" : f === "enabled" ? "已启用" : "已禁用"}
            </button>
          ))}
        </div>
        <button onClick={onRefresh} style={{
          padding: "6px 14px", borderRadius: "7px",
          border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
          color: "#475569", fontSize: "12px", cursor: "pointer",
        }}>刷新</button>
      </Card>

      {/* 各组 */}
      {allGroups.map(({ key, title, models, provider }) => {
        const c = PROVIDER_COLORS[provider];
        const grpSummary = summary[key] ?? { total: models.length, enabled: models.length };
        const isExpanded = expandedGroups[key];
        const groupEnabled = grpSummary.enabled > 0;
        const allEnabled = grpSummary.enabled === grpSummary.total;

        const filteredModels = models.filter((m) => {
          const en = statusMap.get(m.id) ?? true;
          if (filter === "enabled") return en;
          if (filter === "disabled") return !en;
          return true;
        });

        return (
          <div key={key} style={{ marginBottom: "10px" }}>
            {/* Group header */}
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              background: c.bg, border: `1px solid ${c.border}`, borderRadius: "8px",
              padding: "10px 14px",
            }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
              <button onClick={() => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }))} style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontWeight: 600, color: c.text, fontSize: "13px", flex: 1, textAlign: "left",
              }}>
                {title}
              </button>
              {/* 统计 */}
              <span style={{ fontSize: "12px", color: "#475569" }}>
                {grpSummary.enabled}/{grpSummary.total} 已启用
              </span>
              {/* 批量按钮 */}
              <button onClick={() => onToggleProvider(key, true)} style={{
                padding: "3px 10px", borderRadius: "5px", fontSize: "11px",
                border: "1px solid rgba(74,222,128,0.3)", background: "rgba(74,222,128,0.08)",
                color: "#4ade80", cursor: "pointer",
              }}>全部启用</button>
              <button onClick={() => onToggleProvider(key, false)} style={{
                padding: "3px 10px", borderRadius: "5px", fontSize: "11px",
                border: "1px solid rgba(248,113,113,0.3)", background: "rgba(248,113,113,0.08)",
                color: "#f87171", cursor: "pointer",
              }}>全部禁用</button>
              {/* 组级总开关 */}
              <ModelToggle
                enabled={groupEnabled}
                onChange={() => onToggleProvider(key, !allEnabled)}
              />
              <button onClick={() => setExpandedGroups((p) => ({ ...p, [key]: !p[key] }))} style={{
                background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "11px",
              }}>{isExpanded ? "▲" : "▼"}</button>
            </div>

            {/* 模型列表 */}
            {isExpanded && filteredModels.length > 0 && (
              <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px" }}>
                {filteredModels.map((m) => {
                  const enabled = statusMap.get(m.id) ?? true;
                  return (
                    <div key={m.id} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      background: enabled ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.35)",
                      border: `1px solid ${enabled ? "rgba(255,255,255,0.05)" : "rgba(248,113,113,0.12)"}`,
                      borderRadius: "7px", padding: "6px 12px",
                      opacity: enabled ? 1 : 0.55, transition: "all 0.15s",
                    }}>
                      <code style={{
                        fontFamily: "Menlo, monospace", fontSize: "11.5px",
                        color: enabled ? c.text : "#475569",
                        flex: 1, wordBreak: "break-all",
                      }}>{m.id}</code>
                      <span style={{ fontSize: "11.5px", color: "#334155", flexShrink: 0 }}>{m.desc}</span>
                      {m.context && (
                        <span style={{ fontSize: "10px", color: "#334155", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "3px", padding: "1px 5px", flexShrink: 0 }}>{m.context}</span>
                      )}
                      {m.badge && <Badge variant={m.badge} />}
                      <ModelToggle enabled={enabled} onChange={() => onToggleModel(m.id, !enabled)} />
                    </div>
                  );
                })}
              </div>
            )}
            {isExpanded && filteredModels.length === 0 && (
              <div style={{ padding: "10px 14px", color: "#334155", fontSize: "12.5px" }}>
                该过滤条件下无匹配模型
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

type Tab = "home" | "stats" | "models" | "endpoints";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [online, setOnline] = useState<boolean | null>(null);
  const [sillyTavernMode, setSillyTavernMode] = useState(false);
  const [stLoading, setStLoading] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("proxy_api_key") ?? "");
  const [showWizard, setShowWizard] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    openai: false, anthropic: false, gemini: false, openrouter: false,
  });
  const [stats, setStats] = useState<Record<string, { calls: number; errors: number; promptTokens: number; completionTokens: number; totalTokens: number; avgDurationMs: number; avgTtftMs: number | null; health: string; url?: string; dynamic?: boolean; enabled?: boolean }> | null>(null);
  const [statsError, setStatsError] = useState<false | "auth" | "server">(false);
  const [addUrl, setAddUrl] = useState("");
  const [addState, setAddState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [addMsg, setAddMsg] = useState("");
  const [modelStatus, setModelStatus] = useState<ModelStatus[]>([]);
  const [modelSummary, setModelSummary] = useState<Record<string, GroupSummary>>({});

  const baseUrl = window.location.origin;
  const displayUrl: string = (import.meta.env.VITE_BASE_URL as string | undefined) ?? window.location.origin;
  const totalModels = OPENAI_MODELS.length + ANTHROPIC_MODELS.length + GEMINI_MODELS.length + OPENROUTER_MODELS.length;

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${baseUrl}/api/healthz`, { signal: AbortSignal.timeout(5000) });
      setOnline(res.ok);
    } catch { setOnline(false); }
  }, [baseUrl]);

  const fetchSTMode = useCallback(async () => {
    try {
      const key = localStorage.getItem("proxy_api_key") ?? "";
      const res = await fetch(`${baseUrl}/api/settings/sillytavern`, {
        headers: key ? { Authorization: `Bearer ${key}` } : {},
      });
      if (res.ok) { const d = await res.json(); setSillyTavernMode(d.enabled); }
    } catch {}
    setStLoading(false);
  }, [baseUrl]);

  const toggleSTMode = async () => {
    const newVal = !sillyTavernMode;
    setSillyTavernMode(newVal);
    try {
      const res = await fetch(`${baseUrl}/api/settings/sillytavern`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        body: JSON.stringify({ enabled: newVal }),
      });
      if (!res.ok) setSillyTavernMode(!newVal);
    } catch { setSillyTavernMode(!newVal); }
  };

  const fetchStats = useCallback(async (key: string) => {
    if (!key) { setStats(null); setStatsError(false); return; }
    try {
      const r = await fetch(`${baseUrl}/v1/stats`, { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) {
        setStatsError(r.status === 500 ? "server" : "auth");
        return;
      }
      const d = await r.json();
      setStats(d.stats); setStatsError(false);
    } catch { setStatsError("auth"); }
  }, [baseUrl]);

  const addBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = normalizeBackendUrl(addUrl);
    if (!url) return;
    setAddState("loading");
    try {
      const r = await fetch(`${baseUrl}/v1/admin/backends`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await r.json();
      if (!r.ok) { setAddState("err"); setAddMsg(data.error ?? "Failed"); return; }
      setAddState("ok"); setAddMsg(`已添加 ${data.label}`); setAddUrl("");
      setTimeout(() => setAddState("idle"), 3000);
      fetchStats(apiKey);
    } catch { setAddState("err"); setAddMsg("网络错误"); }
  };

  const removeBackend = async (label: string) => {
    await fetch(`${baseUrl}/v1/admin/backends/${label}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    fetchStats(apiKey);
  };

  const toggleBackend = async (label: string, enabled: boolean) => {
    await fetch(`${baseUrl}/v1/admin/backends/${label}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchStats(apiKey);
  };

  const batchToggleBackends = async (labels: string[], enabled: boolean) => {
    await fetch(`${baseUrl}/v1/admin/backends`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ labels, enabled }),
    });
    fetchStats(apiKey);
  };

  const fetchModels = useCallback(async (key: string = apiKey) => {
    if (!key) return;
    try {
      const r = await fetch(`${baseUrl}/v1/admin/models`, { headers: { Authorization: `Bearer ${key}` } });
      if (!r.ok) return;
      const d = await r.json();
      setModelStatus(d.models ?? []);
      setModelSummary(d.summary ?? {});
    } catch {}
  }, [baseUrl, apiKey]);

  const toggleModelProvider = async (provider: string, enabled: boolean) => {
    // Optimistic update
    setModelStatus((prev) => prev.map((m) => m.provider === provider ? { ...m, enabled } : m));
    setModelSummary((prev) => {
      const grp = prev[provider];
      if (!grp) return prev;
      return { ...prev, [provider]: { total: grp.total, enabled: enabled ? grp.total : 0 } };
    });
    try {
      await fetch(`${baseUrl}/v1/admin/models`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ provider, enabled }),
      });
    } catch {}
    fetchModels();
  };

  const toggleModelById = async (id: string, enabled: boolean) => {
    // Optimistic update
    setModelStatus((prev) => prev.map((m) => m.id === id ? { ...m, enabled } : m));
    setModelSummary((prev) => {
      const m = modelStatus.find((ms) => ms.id === id);
      if (!m) return prev;
      const grp = prev[m.provider];
      if (!grp) return prev;
      const delta = enabled ? 1 : -1;
      return { ...prev, [m.provider]: { total: grp.total, enabled: Math.max(0, Math.min(grp.total, grp.enabled + delta)) } };
    });
    try {
      await fetch(`${baseUrl}/v1/admin/models`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id], enabled }),
      });
    } catch {}
    fetchModels();
  };

  const batchRemoveBackends = async (labels: string[]) => {
    await Promise.all(labels.map((l) =>
      fetch(`${baseUrl}/v1/admin/backends/${l}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${apiKey}` },
      })
    ));
    fetchStats(apiKey);
  };

  useEffect(() => {
    checkHealth();
    fetchSTMode();
    fetchStats(apiKey);
    fetchModels(apiKey);
    const iv1 = setInterval(checkHealth, 30000);
    const iv2 = setInterval(() => fetchStats(apiKey), 15000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [checkHealth, fetchSTMode, fetchStats, fetchModels, apiKey]);

  // Auto-show wizard only when server is NOT configured yet.
  // Once PROXY_API_KEY is set server-side, wizard never pops up automatically.
  // Uses sessionStorage so a manual dismiss stays dismissed for this tab's lifetime.
  useEffect(() => {
    if (sessionStorage.getItem("wizard_dismissed") === "1") return;
    fetch(`${baseUrl}/api/setup-status`)
      .then((r) => r.ok ? r.json() : null)
      .then((status: { configured: boolean } | null) => {
        if (!status || status.configured) return;
        setShowWizard(true);
      })
      .catch(() => {});
  }, [baseUrl]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "home", label: "首页" },
    { id: "stats", label: "统计 & 节点" },
    { id: "models", label: "模型管理" },
    { id: "endpoints", label: "端点文档" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "hsl(222,47%,11%)", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {showWizard && (
        <SetupWizard
          baseUrl={baseUrl}
          onComplete={(key) => {
            sessionStorage.setItem("wizard_dismissed", "1");
            setShowWizard(false);
            if (key) {
              setApiKey(key);
              localStorage.setItem("proxy_api_key", key);
            }
          }}
          onDismiss={() => { sessionStorage.setItem("wizard_dismissed", "1"); setShowWizard(false); }}
        />
      )}

      <UpdateBar baseUrl={baseUrl} apiKey={apiKey} />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px",
            }}>⚡</div>
            <h1 style={{ margin: 0, fontSize: "21px", fontWeight: 700, color: "#f1f5f9" }}>Replit2Api</h1>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
              <UpdateBadge baseUrl={baseUrl} apiKey={apiKey} />
              <button onClick={() => setShowWizard(true)} style={{
                padding: "5px 12px", background: "rgba(99,102,241,0.12)",
                border: "1px solid rgba(99,102,241,0.25)", borderRadius: "100px",
                color: "#818cf8", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", gap: "5px",
              }}>🚀 配置向导</button>
              <div style={{
                display: "flex", alignItems: "center", gap: "6px",
                background: online === null ? "rgba(100,116,139,0.15)" : online ? "rgba(74,222,128,0.12)" : "rgba(248,113,113,0.12)",
                border: `1px solid ${online === null ? "rgba(100,116,139,0.3)" : online ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"}`,
                borderRadius: "100px", padding: "4px 10px 4px 8px",
              }}>
                <div style={{
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: online === null ? "#64748b" : online ? "#4ade80" : "#f87171",
                  boxShadow: online ? "0 0 6px #4ade80" : undefined,
                }} />
                <span style={{ fontSize: "12px", color: online === null ? "#64748b" : online ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                  {online === null ? "检测中" : online ? "在线" : "离线"}
                </span>
              </div>
            </div>
          </div>
          <p style={{ color: "#64748b", margin: 0, fontSize: "13.5px", lineHeight: "1.6" }}>
            统一 AI API 网关 · OpenAI / Anthropic / Gemini / OpenRouter · OpenAI 兼容格式
          </p>
        </div>

        {/* Tab bar */}
        <div style={{
          display: "flex", gap: "4px", marginBottom: "24px",
          background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "10px", padding: "4px",
        }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "7px", border: "none",
                background: tab === t.id ? "rgba(99,102,241,0.25)" : "transparent",
                color: tab === t.id ? "#a5b4fc" : "#475569",
                fontSize: "13px", fontWeight: tab === t.id ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                boxShadow: tab === t.id ? "inset 0 0 0 1px rgba(99,102,241,0.35)" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Page content */}
        {tab === "home" && (
          <PageHome
            displayUrl={displayUrl}
            apiKey={apiKey}
            setApiKey={setApiKey}
            sillyTavernMode={sillyTavernMode}
            stLoading={stLoading}
            onToggleSTMode={toggleSTMode}
          />
        )}
        {tab === "stats" && (
          <PageStats
            baseUrl={baseUrl}
            apiKey={apiKey}
            stats={stats}
            statsError={statsError}
            onRefresh={() => fetchStats(apiKey)}
            addUrl={addUrl}
            setAddUrl={setAddUrl}
            addState={addState}
            addMsg={addMsg}
            onAddBackend={addBackend}
            onRemoveBackend={removeBackend}
            onToggleBackend={toggleBackend}
            onBatchToggle={batchToggleBackends}
            onBatchRemove={batchRemoveBackends}
          />
        )}
        {tab === "models" && (
          <PageModels
            baseUrl={baseUrl}
            apiKey={apiKey}
            modelStatus={modelStatus}
            summary={modelSummary}
            onRefresh={() => fetchModels(apiKey)}
            onToggleProvider={toggleModelProvider}
            onToggleModel={toggleModelById}
          />
        )}
        {tab === "endpoints" && (
          <PageEndpoints
            displayUrl={displayUrl}
            expandedGroups={expandedGroups}
            onToggleGroup={(g) => setExpandedGroups((prev) => ({ ...prev, [g]: !prev[g] }))}
            totalModels={totalModels}
          />
        )}

        <div style={{ marginTop: "32px", textAlign: "center", color: "#1e293b", fontSize: "12px" }}>
          Powered by Replit AI Integrations · OpenAI · Anthropic · Gemini · OpenRouter
        </div>
      </div>
    </div>
  );
}
