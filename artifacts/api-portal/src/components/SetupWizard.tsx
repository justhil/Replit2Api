import { useState, useEffect, useRef, useCallback } from "react";

interface Props {
  baseUrl: string;
  onComplete: () => void;
  onDismiss: () => void;
}

interface CopyBlock {
  text: string;
}

interface Message {
  id: number;
  from: "agent" | "user";
  text: string;
  copyBlocks?: CopyBlock[];
  actions?: Action[];
}

interface Action {
  label: string;
  value: string;
  primary?: boolean;
}

let msgId = 0;
const makeMsg = (
  from: Message["from"],
  text: string,
  extras: Partial<Omit<Message, "id" | "from" | "text">> = {}
): Message => ({ id: ++msgId, from, text, ...extras });

function CopyableBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(99,102,241,0.3)",
        borderRadius: "8px",
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginTop: "8px",
      }}
    >
      <span
        style={{
          flex: 1,
          color: "#a5b4fc",
          fontSize: "13px",
          fontFamily: "Menlo, monospace",
          lineHeight: "1.5",
          userSelect: "all",
        }}
      >
        {text}
      </span>
      <button
        onClick={copy}
        style={{
          padding: "5px 12px",
          borderRadius: "6px",
          border: `1px solid ${copied ? "rgba(74,222,128,0.4)" : "rgba(99,102,241,0.4)"}`,
          background: copied ? "rgba(74,222,128,0.12)" : "rgba(99,102,241,0.15)",
          color: copied ? "#4ade80" : "#818cf8",
          fontSize: "11.5px",
          fontWeight: 700,
          cursor: "pointer",
          flexShrink: 0,
          transition: "all 0.2s",
        }}
      >
        {copied ? "已复制 ✓" : "复制"}
      </button>
    </div>
  );
}

export default function SetupWizard({ baseUrl, onComplete, onDismiss }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [checking, setChecking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const addAgent = useCallback(
    (text: string, extras: Partial<Omit<Message, "id" | "from" | "text">> = {}, delay = 600) => {
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((prev) => [...prev, makeMsg("agent", text, extras)]);
      }, delay);
    },
    []
  );

  const addUser = useCallback((text: string) => {
    setMessages((prev) => [...prev, makeMsg("user", text)]);
  }, []);

  const clearActions = useCallback(() => {
    setMessages((prev) => prev.map((m) => ({ ...m, actions: undefined })));
  }, []);

  useEffect(() => {
    setTimeout(() => {
      setMessages([
        makeMsg(
          "agent",
          "你好！我是配置助手。\n\n这个 AI 网关内置了 OpenAI、Claude、Gemini 等所有模型。首次运行需要完成两步初始化，全程通过 Replit Agent 完成，无需手动填写任何密钥。",
          {
            actions: [
              { label: "开始配置", value: "start", primary: true },
              { label: "已经配置好了", value: "already_done" },
            ],
          }
        ),
      ]);
    }, 300);
  }, []);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [messages, typing]);

  const checkSetupStatus = useCallback(async (): Promise<{ configured: boolean; integrationsReady: boolean }> => {
    try {
      const res = await fetch(`${baseUrl}/api/setup-status`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { configured: false, integrationsReady: false };
      return (await res.json()) as { configured: boolean; integrationsReady: boolean };
    } catch {
      return { configured: false, integrationsReady: false };
    }
  }, [baseUrl]);

  const runCheck = useCallback(async () => {
    clearActions();
    setChecking(true);
    addUser("检测一下");
    addAgent("正在检测服务器配置状态…", {}, 300);

    const status = await checkSetupStatus();
    setChecking(false);
    setMessages((prev) => prev.filter((m) => m.text !== "正在检测服务器配置状态…"));

    if (status.configured && status.integrationsReady) {
      addAgent(
        "配置成功！服务器已读取到访问密码，AI 集成也已就绪。\n\n接下来可以选择是否启用自动更新——当上游发布新版本时，你可以一键从门户页面更新。",
        {
          actions: [
            { label: "启用自动更新（推荐）", value: "enable_update", primary: true },
            { label: "跳过，直接使用", value: "finish" },
          ],
        },
        300
      );
    } else if (!status.integrationsReady) {
      addAgent(
        "AI 集成还未初始化。请复制下方指令发给 Replit Agent：",
        {
          copyBlocks: [{ text: "请帮我添加 OpenAI 和 Anthropic 的 AI 集成，然后重启项目" }],
          actions: [{ label: "Agent 已完成，再次检测", value: "check", primary: true }],
        },
        300
      );
    } else {
      addAgent(
        "AI 集成已就绪，但还没检测到 PROXY_API_KEY。密钥保存后需要重启项目才能生效。\n\n请复制下方指令发给 Replit Agent：",
        {
          copyBlocks: [{ text: "请帮我重启项目" }],
          actions: [{ label: "已重启，再次检测", value: "check", primary: true }],
        },
        300
      );
    }
  }, [clearActions, addUser, addAgent, checkSetupStatus]);

  const handleAction = useCallback(
    async (value: string, label: string) => {
      clearActions();

      if (value === "start") {
        addUser(label);
        addAgent(
          "第一步：初始化 AI 集成（OpenAI + Anthropic）。\n\n打开 Replit 编辑器的 AI 对话框，复制下方指令发送给 Agent：",
          {
            copyBlocks: [
              { text: "请帮我添加 OpenAI 和 Anthropic 的 AI 集成" },
            ],
            actions: [
              { label: "Agent 已完成 ✓", value: "integrations_done", primary: true },
              { label: "找不到 AI 对话框", value: "help_find" },
            ],
          }
        );
        return;
      }

      if (value === "help_find") {
        addUser(label);
        addAgent(
          "Replit 编辑器右侧有一个聊天图标，点开就是 AI 对话框。\n\n如果你看到的是这个预览页面，请切换回编辑器标签页，找到 Agent 对话框后复制下方指令：",
          {
            copyBlocks: [
              { text: "请帮我添加 OpenAI 和 Anthropic 的 AI 集成" },
            ],
            actions: [
              { label: "Agent 已完成 ✓", value: "integrations_done", primary: true },
            ],
          }
        );
        return;
      }

      if (value === "integrations_done") {
        addUser(label);
        addAgent(
          "第二步：设置访问密码（PROXY_API_KEY）。\n\n复制下方指令发给 Agent，它会帮你安全存储密码：",
          {
            copyBlocks: [
              { text: "请帮我设置 PROXY_API_KEY Secret，用于访问认证" },
            ],
            actions: [
              { label: "Agent 已设置完成 ✓", value: "set_done", primary: true },
            ],
          }
        );
        return;
      }

      if (value === "set_done") {
        addUser(label);
        addAgent(
          "密码已安全存入 Replit Secrets。\n\n最后一步：重启项目让服务器读取新配置：",
          {
            copyBlocks: [{ text: "请帮我重启项目" }],
            actions: [
              { label: "Agent 已重启 ✓，检测一下", value: "check", primary: true },
            ],
          }
        );
        return;
      }

      if (value === "enable_update") {
        addUser(label);
        addAgent(
          "好的！请复制下方指令发给 Replit Agent，它会帮你安全保存更新检测地址：",
          {
            copyBlocks: [
              {
                text: "请帮我设置 UPDATE_CHECK_URL Secret，值为 https://replit-api-public-Akatsukis036s.replit.app/api/update/version",
              },
            ],
            actions: [
              { label: "Agent 已设置完成 ✓，继续", value: "update_set_done", primary: true },
              { label: "跳过，直接使用", value: "finish" },
            ],
          }
        );
        return;
      }

      if (value === "update_set_done") {
        addUser(label);
        addAgent(
          "自动更新已启用！之后门户页面右上角的版本徽标会提示你有新版本，点击「立即更新」即可一键升级，无需手动操作。\n\n重启项目后更新检测即生效：",
          {
            copyBlocks: [{ text: "请帮我重启项目" }],
            actions: [
              { label: "完成，开始使用 🚀", value: "finish", primary: true },
            ],
          }
        );
        return;
      }

      if (value === "already_done") {
        addUser(label);
        addAgent("好的，我来检测服务器状态。", {}, 300);
        setTimeout(() => runCheck(), 900);
        return;
      }

      if (value === "check") {
        await runCheck();
        return;
      }

      if (value === "finish") {
        onComplete();
        return;
      }
    },
    [clearActions, addUser, addAgent, runCheck, onComplete]
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          background: "hsl(222,47%,12%)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "18px",
          width: "100%",
          maxWidth: "520px",
          height: "min(600px, 88vh)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "34px", height: "34px", borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "17px", flexShrink: 0,
            }}
          >🤖</div>
          <div>
            <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "13.5px" }}>配置助手</div>
            <div style={{ fontSize: "11px", color: "#4ade80", display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#4ade80" }} />
              在线
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
            {checking && (
              <span style={{ fontSize: "11px", color: "#6366f1", animation: "pulse 1.5s ease-in-out infinite" }}>
                检测中…
              </span>
            )}
            <button
              onClick={onDismiss}
              style={{ background: "none", border: "none", color: "#334155", fontSize: "20px", cursor: "pointer", lineHeight: 1, padding: "4px" }}
            >×</button>
          </div>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1, overflowY: "auto", padding: "16px",
            display: "flex", flexDirection: "column", gap: "10px",
          }}
        >
          {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <div style={{
                display: "flex",
                justifyContent: m.from === "agent" ? "flex-start" : "flex-end",
                gap: "8px", alignItems: "flex-end",
              }}>
                {m.from === "agent" && (
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", flexShrink: 0,
                  }}>🤖</div>
                )}
                <div style={{
                  maxWidth: "86%",
                  padding: "10px 13px",
                  borderRadius: m.from === "agent" ? "4px 13px 13px 13px" : "13px 4px 13px 13px",
                  background: m.from === "agent" ? "rgba(99,102,241,0.14)" : "rgba(74,222,128,0.1)",
                  border: `1px solid ${m.from === "agent" ? "rgba(99,102,241,0.22)" : "rgba(74,222,128,0.18)"}`,
                  color: m.from === "agent" ? "#cbd5e1" : "#a7f3d0",
                  fontSize: "13.5px", lineHeight: "1.65", whiteSpace: "pre-line",
                }}>
                  {m.text}
                  {m.copyBlocks?.map((cb, i) => (
                    <CopyableBlock key={i} text={cb.text} />
                  ))}
                </div>
              </div>

              {m.actions && (
                <div style={{ display: "flex", gap: "7px", flexWrap: "wrap", paddingLeft: "34px" }}>
                  {m.actions.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => handleAction(a.value, a.label)}
                      disabled={checking}
                      style={{
                        padding: "6px 14px", borderRadius: "20px",
                        border: `1px solid ${a.primary ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.1)"}`,
                        background: a.primary ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.04)",
                        color: a.primary ? "#a5b4fc" : "#64748b",
                        fontSize: "12.5px", fontWeight: 600,
                        cursor: checking ? "not-allowed" : "pointer",
                        opacity: checking ? 0.5 : 1,
                      }}
                    >{a.label}</button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {typing && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
              <div style={{
                width: "26px", height: "26px", borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", flexShrink: 0,
              }}>🤖</div>
              <div style={{
                padding: "10px 14px", borderRadius: "4px 13px 13px 13px",
                background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.18)",
                display: "flex", gap: "4px", alignItems: "center",
              }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{
                    width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1",
                    animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Footer */}
        <div style={{
          padding: "10px 18px",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          fontSize: "11px", color: "#1e293b", textAlign: "center", flexShrink: 0,
        }}>
          所有配置通过 Replit Agent 安全完成，密钥不会经过此页面
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
