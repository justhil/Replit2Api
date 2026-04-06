import { Router, type IRouter, type Request, type Response } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  readFileSync, writeFileSync, existsSync,
  readdirSync, statSync, mkdirSync,
} from "fs";
import { resolve, join, dirname, relative } from "path";

const router: IRouter = Router();
const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// 工作区根路径（monorepo 根）
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = resolve(process.cwd(), "../../");

// ---------------------------------------------------------------------------
// 版本信息
// ---------------------------------------------------------------------------

interface VersionInfo {
  version: string;
  name?: string;
  releaseDate?: string;
  releaseNotes?: string;
}

function readLocalVersion(): VersionInfo {
  const candidates = [
    resolve(process.cwd(), "version.json"),
    resolve(WORKSPACE_ROOT, "version.json"),
  ];
  for (const p of candidates) {
    try {
      if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as VersionInfo;
    } catch {}
  }
  return { version: "unknown" };
}

function parseVersion(v: string): number[] {
  return v.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
}

function isNewer(remote: string, local: string): boolean {
  const r = parseVersion(remote);
  const l = parseVersion(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    if ((r[i] ?? 0) > (l[i] ?? 0)) return true;
    if ((r[i] ?? 0) < (l[i] ?? 0)) return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function checkApiKey(req: Request, res: Response): boolean {
  const proxyKey = process.env.PROXY_API_KEY;
  if (!proxyKey) {
    res.status(500).json({ error: "Server API key not configured" });
    return false;
  }
  const authHeader = req.headers["authorization"];
  const xApiKey = req.headers["x-api-key"];
  let provided: string | undefined;
  if (authHeader?.startsWith("Bearer ")) provided = authHeader.slice(7);
  else if (typeof xApiKey === "string") provided = xApiKey;
  if (!provided || provided !== proxyKey) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 文件扫描：收集所有源文件内容
// ---------------------------------------------------------------------------

const BUNDLE_INCLUDE_DIRS = [
  "artifacts/api-server/src",
  "artifacts/api-portal/src",
];

const BUNDLE_INCLUDE_FILES = [
  "version.json",
  "artifacts/api-portal/index.html",
  "artifacts/api-server/build.mjs",
];

const BUNDLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json", ".css", ".html"]);
const BUNDLE_EXCLUDE = new Set(["node_modules", "dist", ".git", ".cache"]);

function scanDir(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!existsSync(dir)) return files;

  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      if (BUNDLE_EXCLUDE.has(entry)) continue;
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        const ext = entry.slice(entry.lastIndexOf("."));
        if (BUNDLE_EXTENSIONS.has(ext)) {
          const rel = relative(WORKSPACE_ROOT, full);
          try {
            files[rel] = readFileSync(full, "utf8");
          } catch {}
        }
      }
    }
  };
  walk(dir);
  return files;
}

function buildBundle(): Record<string, string> {
  const files: Record<string, string> = {};

  for (const dir of BUNDLE_INCLUDE_DIRS) {
    Object.assign(files, scanDir(join(WORKSPACE_ROOT, dir)));
  }

  for (const rel of BUNDLE_INCLUDE_FILES) {
    const full = join(WORKSPACE_ROOT, rel);
    try {
      if (existsSync(full)) files[rel] = readFileSync(full, "utf8");
    } catch {}
  }

  return files;
}

// ---------------------------------------------------------------------------
// GET /update/version — 本地版本 + 可选远端检测
// ---------------------------------------------------------------------------

router.get("/update/version", async (_req: Request, res: Response) => {
  const local = readLocalVersion();
  const checkUrl = process.env.UPDATE_CHECK_URL;

  if (!checkUrl) {
    // 未配置更新地址时返回本地版本，供上游检测用
    res.json({ ...local, hasUpdate: false, updateCheckDisabled: true });
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const r = await fetch(checkUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const remote = (await r.json()) as VersionInfo;
    const hasUpdate = isNewer(remote.version, local.version);
    res.json({
      ...local,
      hasUpdate,
      latestVersion: remote.version,
      latestReleaseNotes: remote.releaseNotes,
      latestReleaseDate: remote.releaseDate,
    });
  } catch (err) {
    res.json({ ...local, hasUpdate: false, checkError: err instanceof Error ? err.message : "检测失败" });
  }
});

// ---------------------------------------------------------------------------
// GET /update/bundle — 公开端点，返回所有源文件内容
// 供其他实例下载后应用更新（Replit 间更新，无需 GitHub）
// ---------------------------------------------------------------------------

router.get("/update/bundle", (_req: Request, res: Response) => {
  try {
    const local = readLocalVersion();
    const files = buildBundle();
    res.json({ version: local.version, releaseNotes: local.releaseNotes, fileCount: Object.keys(files).length, files });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "打包失败" });
  }
});

// ---------------------------------------------------------------------------
// POST /update/apply — 受保护：从上游下载文件包并应用
// UPDATE_CHECK_URL 形如 https://example.replit.app/api/update/version
// bundle 地址自动推导为  https://example.replit.app/api/update/bundle
// ---------------------------------------------------------------------------

let updateInProgress = false;

router.post("/update/apply", async (req: Request, res: Response) => {
  if (!checkApiKey(req, res)) return;
  if (updateInProgress) {
    res.status(409).json({ error: "更新正在进行中，请稍候" });
    return;
  }

  const checkUrl = process.env.UPDATE_CHECK_URL;
  if (!checkUrl) {
    res.status(400).json({
      error: "未配置 UPDATE_CHECK_URL",
      hint: "请通过 Replit Agent 设置 UPDATE_CHECK_URL Secret，值为上游服务器地址 + /api/update/version",
    });
    return;
  }

  // 推导 bundle URL：把末尾的 /version 换成 /bundle
  const bundleUrl = checkUrl.replace(/\/update\/version$/, "/update/bundle");

  // 立即响应，后台执行
  res.json({ status: "started", message: "开始下载更新包，完成后服务器将自动重启（约 30 秒）…" });
  updateInProgress = true;

  (async () => {
    try {
      // 1. 下载文件包
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const r = await fetch(bundleUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`下载失败 HTTP ${r.status}`);

      const bundle = (await r.json()) as { version: string; files: Record<string, string> };

      // 2. 写入文件
      for (const [relPath, content] of Object.entries(bundle.files)) {
        const fullPath = join(WORKSPACE_ROOT, relPath);
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, "utf8");
      }

      // 3. 安装依赖
      await execFileAsync("pnpm", ["install", "--no-frozen-lockfile"], { cwd: WORKSPACE_ROOT });

      // 4. 退出进程 → Workflow 自动重新 build & start
      setTimeout(() => process.exit(0), 500);
    } catch (err) {
      updateInProgress = false;
      console.error("[update] 更新失败:", err instanceof Error ? err.message : err);
    }
  })();
});

// ---------------------------------------------------------------------------
// GET /update/status
// ---------------------------------------------------------------------------

router.get("/update/status", (_req: Request, res: Response) => {
  res.json({ inProgress: updateInProgress });
});

export default router;
