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
        {[
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
        ].map((release) => (
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
        ))}
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

function PageStats({
  baseUrl, apiKey, stats, statsError, onRefresh,
  addUrl, setAddUrl, addState, addMsg, onAddBackend, onRemoveBackend,
}: {
  baseUrl: string;
  apiKey: string;
  stats: Record<string, { calls: number; errors: number; promptTokens: number; completionTokens: number; totalTokens: number; avgDurationMs: number; avgTtftMs: number | null; health: string; url?: string; dynamic?: boolean }> | null;
  statsError: boolean;
  onRefresh: () => void;
  addUrl: string;
  setAddUrl: (u: string) => void;
  addState: "idle" | "loading" | "ok" | "err";
  addMsg: string;
  onAddBackend: (e: React.FormEvent) => void;
  onRemoveBackend: (label: string) => void;
}) {
  const _ = baseUrl; // used by parent
  return (
    <>
      {/* Stats */}
      <Card style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <SectionTitle>用量统计</SectionTitle>
          <button onClick={onRefresh} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px", padding: "4px 10px", color: "#64748b", fontSize: "12px",
            cursor: "pointer", marginTop: "-16px",
          }}>刷新</button>
        </div>

        {!apiKey ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>请先在首页填入 API Key 后查看统计。</p>
        ) : statsError ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#f87171" }}>统计加载失败，请检查 API Key 是否正确。</p>
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
              {Object.entries(stats).map(([label, s]) => (
                <div key={label} style={{
                  background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px", padding: "12px 14px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: s.health === "healthy" ? "#4ade80" : "#f87171", boxShadow: s.health === "healthy" ? "0 0 5px #4ade80" : undefined, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#94a3b8", fontFamily: "Menlo, monospace" }}>{label}</span>
                    {s.dynamic && <span style={{ fontSize: "10px", color: "#a78bfa", background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.3)", borderRadius: "4px", padding: "1px 5px" }}>动态</span>}
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
              ))}
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
            {addState === "ok" && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#4ade80" }}>{addMsg}</p>}
            {addState === "err" && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#f87171" }}>{addMsg}</p>}

            {stats && Object.entries(stats).some(([, s]) => s.dynamic) && (
              <div style={{ marginTop: "14px" }}>
                <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#334155" }}>动态节点（重新发布后清除）：</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {Object.entries(stats).filter(([, s]) => s.dynamic).map(([label, s]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "7px", padding: "8px 12px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.health === "healthy" ? "#4ade80" : "#f87171" }} />
                      <span style={{ flex: 1, fontSize: "12px", color: "#64748b", fontFamily: "Menlo, monospace", overflow: "hidden", textOverflow: "ellipsis" }}>{s.url ?? label}</span>
                      <span style={{ fontSize: "11px", color: "#64748b" }}>{s.calls} 次</span>
                      <button onClick={() => onRemoveBackend(label)} style={{ background: "none", border: "none", color: "#f87171", fontSize: "12px", cursor: "pointer", padding: "0 4px" }}>移除</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <GitHubPublishCard baseUrl={baseUrl} apiKey={apiKey} />
      <FleetManager />
    </>
  );
}

// ---------------------------------------------------------------------------
// GitHub 发布卡片（管理员使用：一键将当前代码推送到 GitHub）
// ---------------------------------------------------------------------------

function GitHubPublishCard({ baseUrl, apiKey }: { baseUrl: string; apiKey: string }) {
  const [state, setState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [commitUrl, setCommitUrl] = useState("");

  const publish = async () => {
    if (!apiKey) { setMsg("请先在首页填入 API Key"); setState("err"); return; }
    setState("loading");
    setMsg("正在推送到 GitHub…");
    setCommitUrl("");
    try {
      const r = await fetch(`${baseUrl}/api/update/publish`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const d = await r.json();
      if (!r.ok) { setState("err"); setMsg(d.error ?? "推送失败"); }
      else {
        setState("ok");
        setMsg(`✓ 已推送 ${d.pushed} 个文件`);
        if (d.commitUrl) setCommitUrl(d.commitUrl);
      }
    } catch {
      setState("err"); setMsg("网络错误，请重试");
    }
  };

  return (
    <Card style={{ marginBottom: "14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <SectionTitle>同步到 GitHub</SectionTitle>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#334155" }}>
            将当前版本以单次 commit 推送到{" "}
            <a href={`https://github.com/Akatsuki03/Replit2Api`} target="_blank" rel="noreferrer"
              style={{ color: "#818cf8", textDecoration: "none" }}>
              Akatsuki03/Replit2Api
            </a>
            ，子节点可自动从 GitHub 检测并拉取更新。
          </p>
        </div>
        <button
          onClick={publish}
          disabled={state === "loading" || !apiKey}
          style={{
            background: state === "ok" ? "rgba(74,222,128,0.15)" : "rgba(99,102,241,0.2)",
            border: `1px solid ${state === "ok" ? "rgba(74,222,128,0.4)" : "rgba(99,102,241,0.4)"}`,
            color: state === "ok" ? "#4ade80" : "#818cf8",
            borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 600,
            cursor: (state === "loading" || !apiKey) ? "not-allowed" : "pointer",
            opacity: !apiKey ? 0.5 : 1, flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          {state === "loading" ? "推送中…" : state === "ok" ? "已同步 ✓" : "📤 推送到 GitHub"}
        </button>
      </div>

      {/* 状态提示 */}
      {msg && (
        <div style={{
          padding: "8px 12px", borderRadius: "8px", fontSize: "12.5px",
          background: state === "err" ? "rgba(239,68,68,0.08)" : "rgba(99,102,241,0.08)",
          border: `1px solid ${state === "err" ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.2)"}`,
          color: state === "err" ? "#f87171" : "#94a3b8",
        }}>
          {msg}
          {commitUrl && (
            <a href={commitUrl} target="_blank" rel="noreferrer"
              style={{ color: "#818cf8", marginLeft: "10px", textDecoration: "none", fontSize: "11.5px" }}>
              查看 commit →
            </a>
          )}
        </div>
      )}

      {/* 子节点配置提示 */}
      <div style={{
        marginTop: "12px", padding: "9px 12px", borderRadius: "8px",
        background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)",
        fontSize: "12px", color: "#475569", lineHeight: "1.8",
      }}>
        <span style={{ color: "#64748b", fontWeight: 600 }}>子节点配置：</span>{" "}
        在 Remix 实例的 Replit Secrets 中设置
        <code style={{ color: "#a78bfa", fontSize: "11px", background: "rgba(167,139,250,0.1)", borderRadius: "4px", padding: "1px 5px", marginLeft: "4px" }}>
          UPDATE_CHECK_URL
        </code>
        {" "}={" "}
        <code style={{ color: "#94a3b8", fontSize: "11px", wordBreak: "break-all" }}>
          https://raw.githubusercontent.com/Akatsuki03/Replit2Api/main/version.json
        </code>
      </div>
    </Card>
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
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        <input style={{ ...inp, flex: "0 0 110px" }} placeholder="名称" value={addName} onChange={(e) => setAddName(e.target.value)} />
        <input style={{ ...inp, flex: "2 1 180px" }} placeholder="https://your-proxy.replit.app" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} />
        <input type="password" style={{ ...inp, flex: "1 1 130px" }} placeholder="PROXY_API_KEY" value={addKey} onChange={(e) => setAddKey(e.target.value)} />
        <button onClick={addInst} disabled={!addUrl || !addKey} style={{
          background: "rgba(99,102,241,0.7)", border: "1px solid rgba(99,102,241,0.6)",
          color: "#e0e7ff", borderRadius: "7px", padding: "7px 16px",
          fontSize: "13px", fontWeight: 600, cursor: (!addUrl || !addKey) ? "not-allowed" : "pointer",
          opacity: (!addUrl || !addKey) ? 0.5 : 1, flexShrink: 0,
        }}>添加</button>
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
// Main App
// ---------------------------------------------------------------------------

type Tab = "home" | "stats" | "endpoints";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [online, setOnline] = useState<boolean | null>(null);
  const [sillyTavernMode, setSillyTavernMode] = useState(false);
  const [stLoading, setStLoading] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("proxy_api_key") ?? "");
  const [showWizard, setShowWizard] = useState(() => !localStorage.getItem("proxy_api_key"));
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    openai: false, anthropic: false, gemini: false, openrouter: false,
  });
  const [stats, setStats] = useState<Record<string, { calls: number; errors: number; promptTokens: number; completionTokens: number; totalTokens: number; avgDurationMs: number; avgTtftMs: number | null; health: string; url?: string; dynamic?: boolean }> | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addState, setAddState] = useState<"idle" | "loading" | "ok" | "err">("idle");
  const [addMsg, setAddMsg] = useState("");

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
      if (!r.ok) { setStatsError(true); return; }
      const d = await r.json();
      setStats(d.stats); setStatsError(false);
    } catch { setStatsError(true); }
  }, [baseUrl]);

  const addBackend = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = addUrl.trim().replace(/\/+$/, "");
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

  useEffect(() => {
    checkHealth();
    fetchSTMode();
    fetchStats(apiKey);
    const iv1 = setInterval(checkHealth, 30000);
    const iv2 = setInterval(() => fetchStats(apiKey), 15000);
    return () => { clearInterval(iv1); clearInterval(iv2); };
  }, [checkHealth, fetchSTMode, fetchStats, apiKey]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "home", label: "首页" },
    { id: "stats", label: "统计 & 节点" },
    { id: "endpoints", label: "端点文档" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "hsl(222,47%,11%)", color: "#e2e8f0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {showWizard && (
        <SetupWizard baseUrl={baseUrl} onComplete={() => setShowWizard(false)} onDismiss={() => setShowWizard(false)} />
      )}

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "10px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px",
            }}>⚡</div>
            <h1 style={{ margin: 0, fontSize: "21px", fontWeight: 700, color: "#f1f5f9" }}>AI Proxy Gateway</h1>
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
