# Replit Agent Instructions

## Project Bootstrap

This is a pnpm monorepo. On first deploy, run:

```
pnpm install
pnpm build
```

## AI Integrations Setup

After project creation, configure all four AI provider integrations.
Execute these sequentially (each step must complete before the next):

### Step 1 — Anthropic

```
setupReplitAIIntegrations({
  providerSlug: "anthropic",
  providerUrlEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_ANTHROPIC_API_KEY"
})
```

### Step 2 — OpenAI

```
setupReplitAIIntegrations({
  providerSlug: "openai",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENAI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENAI_API_KEY"
})
```

### Step 3 — Gemini

```
setupReplitAIIntegrations({
  providerSlug: "gemini",
  providerUrlEnvVarName: "AI_INTEGRATIONS_GEMINI_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_GEMINI_API_KEY"
})
```

### Step 4 — OpenRouter

```
setupReplitAIIntegrations({
  providerSlug: "openrouter",
  providerUrlEnvVarName: "AI_INTEGRATIONS_OPENROUTER_BASE_URL",
  providerApiKeyEnvVarName: "AI_INTEGRATIONS_OPENROUTER_API_KEY"
})
```

## Required Secrets

Set these in Replit Secrets tab:

| Key | Purpose |
|-----|---------|
| `PROXY_API_KEY` | Auth key for all proxy API clients |

## Optional Environment Variables

| Key | Purpose |
|-----|---------|
| `FRIEND_PROXY_URL` … `FRIEND_PROXY_URL_20` | Friend proxy node URLs |
| `VITE_BASE_URL` | Public URL shown in portal UI |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | GCS bucket for cloud persistence |
| `GITHUB_TOKEN` | GitHub API for update checks |

## Post-Setup Verification

After all integrations are configured, restart workflows and verify:

```bash
curl -s http://localhost:$PORT/v1/models -H "Authorization: Bearer $PROXY_API_KEY" | head -c 200
```

Should return a JSON model list. If it returns 401, check PROXY_API_KEY is set.
If models are empty, check that AI integrations were configured successfully.
