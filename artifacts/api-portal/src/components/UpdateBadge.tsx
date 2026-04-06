import { useState, useEffect, useCallback } from "react";

interface VersionInfo {
  version: string;
  name?: string;
  releaseNotes?: string;
  hasUpdate: boolean;
  updateCheckDisabled?: boolean;
  upstreamUrl?: string;
  latestVersion?: string;
  latestReleaseNotes?: string;
  latestReleaseDate?: string;
  checkError?: string;
}

interface Props {
  baseUrl: string;
  apiKey: string;
}

type UpdateState = "idle" | "applying" | "done" | "error";

export default function UpdateBadge({ baseUrl, apiKey }: Props) {
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [open, setOpen] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateMsg, setUpdateMsg] = useState("");

  const fetchVersion = useCallback(async () => {
    try {
      const r = await fetch(`${baseUrl}/api/update/version`);
      if (r.ok) setInfo(await r.json());
    } catch {}
  }, [baseUrl]);

  useEffect(() => {
    fetchVersion();
    const t = setInterval(fetchVersion, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchVersion]);

  const applyUpdate = async () => {
    if (!apiKey) {
      setUpdateMsg("请先在下方输入 API Key 后再执行更新");
      setUpdateState("error");
      return;
    }
    setUpdateState("applying");
    setUpdateMsg("正在拉取最新代码，完成后服务器将自动重启…");
    try {
      const r = await fetch(`${baseUrl}/api/update/apply`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const d = await r.json();
      if (!r.ok) {
        setUpdateState("error");
        setUpdateMsg(d.hint ?? d.error ?? "更新失败");
      } else {
        setUpdateState("done");
        setUpdateMsg("更新指令已发送，服务器正在重启，约 30 秒后刷新页面…");
        setTimeout(() => window.location.reload(), 30000);
      }
    } catch {
      setUpdateState("error");
      setUpdateMsg("网络错误，请重试");
    }
  };

  if (!info) return null;

  const hasUpdate = info.hasUpdate && !info.updateCheckDisabled;

  return (
    <>
      {/* 版本徽标 */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          padding: "3px 10px",
          borderRadius: "12px",
          border: `1px solid ${hasUpdate ? "rgba(251,191,36,0.45)" : "rgba(255,255,255,0.1)"}`,
          background: hasUpdate ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)",
          color: hasUpdate ? "#fbbf24" : "#475569",
          fontSize: "11.5px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "Menlo, monospace",
          transition: "all 0.2s",
        }}
      >
        {hasUpdate && (
          <span style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: "#fbbf24", flexShrink: 0,
            animation: "pulse 2s ease-in-out infinite",
          }} />
        )}
        v{info.version}
        {hasUpdate && <span style={{ fontSize: "10px" }}>↑ {info.latestVersion}</span>}
      </button>

      {/* 详情弹窗 */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px", backdropFilter: "blur(6px)",
          }}
        >
          <div style={{
            background: "hsl(222,47%,12%)",
            border: "1px solid rgba(99,102,241,0.25)",
            borderRadius: "16px",
            width: "100%", maxWidth: "460px",
            padding: "24px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
          }}>
            {/* 标题 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <div>
                <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: "15px" }}>AI 网关 版本信息</div>
                <div style={{ color: "#475569", fontSize: "12px", marginTop: "2px" }}>
                  当前版本 <span style={{ color: "#a5b4fc", fontFamily: "Menlo, monospace" }}>v{info.version}</span>
                </div>
              </div>
              <button
                onClick={() => { setOpen(false); setUpdateState("idle"); setUpdateMsg(""); }}
                style={{ background: "none", border: "none", color: "#334155", fontSize: "22px", cursor: "pointer" }}
              >×</button>
            </div>

            {/* 当前版本说明 */}
            {info.releaseNotes && (
              <div style={{
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "16px",
              }}>
                <div style={{ color: "#818cf8", fontSize: "11px", fontWeight: 700, marginBottom: "6px" }}>当前版本说明</div>
                <div style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6" }}>{info.releaseNotes}</div>
              </div>
            )}

            {/* 更新状态 */}
            {info.updateCheckDisabled && (
              <div style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "16px",
                color: "#475569", fontSize: "13px", lineHeight: "1.7",
              }}>
                <div style={{ color: "#64748b", fontWeight: 600, marginBottom: "6px", fontSize: "12px" }}>未启用自动更新</div>
                如需接收新版本推送，请通过 Replit Agent 设置 Secret：
                <code style={{ display: "block", marginTop: "8px", padding: "8px 10px", borderRadius: "6px",
                  background: "rgba(0,0,0,0.3)", color: "#94a3b8", fontSize: "11.5px", wordBreak: "break-all" }}>
                  UPDATE_CHECK_URL = https://raw.githubusercontent.com/Akatsuki03/Replit2Api/main/version.json
                </code>
                <div style={{ color: "#475569", fontSize: "12px", marginTop: "8px" }}>
                  设置后，更新包将直接从 GitHub 仓库拉取，无需依赖上游 Replit 实例在线。
                </div>
              </div>
            )}

            {info.checkError && !hasUpdate && (
              <div style={{
                background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "16px",
                color: "#f87171", fontSize: "12.5px",
              }}>
                检测失败：{info.checkError}
              </div>
            )}

            {hasUpdate && (
              <div style={{
                background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "16px",
              }}>
                <div style={{ color: "#fbbf24", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                  发现新版本 v{info.latestVersion}
                  {info.latestReleaseDate && <span style={{ fontWeight: 400, color: "#92400e", marginLeft: "8px" }}>{info.latestReleaseDate}</span>}
                </div>
                {info.latestReleaseNotes && (
                  <div style={{ color: "#94a3b8", fontSize: "13px", lineHeight: "1.6" }}>{info.latestReleaseNotes}</div>
                )}
              </div>
            )}

            {/* 操作区 */}
            {updateState !== "idle" && (
              <div style={{
                background: updateState === "error" ? "rgba(239,68,68,0.08)" : "rgba(74,222,128,0.06)",
                border: `1px solid ${updateState === "error" ? "rgba(239,68,68,0.2)" : "rgba(74,222,128,0.15)"}`,
                borderRadius: "10px", padding: "12px 14px", marginBottom: "14px",
                color: updateState === "error" ? "#f87171" : "#86efac",
                fontSize: "13px", lineHeight: "1.6",
              }}>
                {updateState === "applying" && (
                  <span style={{ marginRight: "8px", animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                )}
                {updateMsg}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { fetchVersion(); }}
                style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  color: "#475569", fontSize: "13px", cursor: "pointer",
                }}
              >
                重新检测
              </button>

              {hasUpdate && (
                <button
                  onClick={applyUpdate}
                  disabled={updateState === "applying" || updateState === "done"}
                  style={{
                    padding: "8px 18px", borderRadius: "8px",
                    border: "1px solid rgba(251,191,36,0.4)",
                    background: updateState === "applying" ? "rgba(251,191,36,0.05)" : "rgba(251,191,36,0.12)",
                    color: "#fbbf24", fontSize: "13px", fontWeight: 600,
                    cursor: updateState === "applying" ? "not-allowed" : "pointer",
                    opacity: updateState === "applying" ? 0.6 : 1,
                  }}
                >
                  {updateState === "applying" ? "更新中…" : updateState === "done" ? "已完成 ✓" : "立即更新"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      `}</style>
    </>
  );
}
