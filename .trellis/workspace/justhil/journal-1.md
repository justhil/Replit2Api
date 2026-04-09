# Journal - justhil (Part 1)

> AI development session journal
> Started: 2026-04-08

---



## Session 1: Streaming TTFT & Throughput Optimization

**Date**: 2026-04-10
**Task**: Streaming TTFT & Throughput Optimization

### Summary

Full-chain performance audit and optimization for proxy streaming pipeline

### Main Changes

## 全链路性能瓶颈分析与优化

对 `proxy.ts` 进行了从下游到上游再回到下游的全链路性能审计，识别并修复了 5 个性能瓶颈。

| 优化项 | 影响 | 改动 |
|--------|------|------|
| **fakeStream 人为延迟** | 1000字符从 ~2.5s → ~0ms | chunk 4→20字符, setTimeout(10ms)→setImmediate |
| **SDK 客户端单例化** | 每请求省去 TLS 握手 (~5-15ms TTFT) | 按 apiKey+baseURL 缓存实例 |
| **延迟 SSE headers 提交** | 保留连接失败时的 retry 窗口 | OpenAI/Claude/Gemini 全部延迟到上游确认后 |
| **Claude chunk 构建优化** | 减少每个 delta 的 GC 压力 | 预构建 chunkPrefix + emitDelta 辅助函数 |
| **Keepalive 统一 20s** | 减少 4 倍无用 write 调用 | 5s→20s，所有 handler 统一 |

**Modified Files**:
- `artifacts/api-server/src/routes/proxy.ts` (+61, -46)


### Git Commits

| Hash | Message |
|------|---------|
| `e84126c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
