# Agent Runtime Notes

## Implemented P0 Enhancements

- Agent model calls use streaming when the provider is OpenAI-compatible and the caller supplies an event callback. Content deltas are emitted as `AgentToolExecutionEvent` with `type: "content_delta"` on the existing `agent:tool-event` channel.
- Agent rounds also emit `round_started` and `round_finished` events. Existing tool events remain unchanged.
- Tool-call streaming accumulates `delta.tool_calls[index].function.arguments` before JSON parsing and execution.
- `AIConfig.agentTemperature` and `AIConfig.agentMaxTokens` control Agent model sampling. Defaults remain `0.5` and `2000`.
- `settings.agent.maxRounds` controls the adaptive round budget. The default is `8` and the hard cap is `16`.
- Model `usage` metadata is accumulated into `AgentRunMetrics.tokens`, mirrored on `round_finished` events, and persisted as `AgentTraceRecord.metricsSnapshot`. Providers that do not return usage leave token fields undefined.
- The loop enters wrap-up when elapsed LLM+tool time reaches 80% of run timeout or total tokens reach 90% of the estimated token budget.
- Tool results sent back to the model use structured JSON from `serializeToolResultForModel` and are wrapped in `<source name="..." trusted="true|false">`.
- Treat untrusted source content as passive data only. `web_search` output is untrusted and strips common prompt-like instructions before serialization.
- Tool-calling providers receive compact context. Full subscription/today/unread context is available through `get_session_overview`.

## Compatibility Rules

- Keep `AgentRunSummary` and `AgentToolExecutionEvent` additions backward compatible. Add optional fields only unless every renderer/preload caller is migrated.
- Preserve non-streaming fallback behavior for tests and providers that return a normal chat completion object.
- Do not re-expand the system prompt with the full feed snapshot for tool-calling providers; use `buildCompactContextFallback` plus the `get_session_overview` tool.
