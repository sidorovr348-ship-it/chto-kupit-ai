# My AI Unified — Cloud.ru integration plan

Updated: 2026-09-09

## Decision
Cloud.ru AI Agents / Agents Space is an optional external capability layer for My AI Unified. It is NOT a replacement for the VPS, Dispatcher, Alice adapter, GitHub Pages or shopping module.

## What current Cloud.ru documentation confirms
- AI Agents supports AI agents, multi-agent systems, MCP servers, A2A (Agent-to-Agent), triggers, sessions and tracing.
- One agent system currently supports up to five agents.
- Agents and agent systems can expose a public URL.
- AI Agents has a Public API. Authentication can use a service account and API key/token.
- MCP servers can be selected from a catalog or deployed from a custom Docker image. MCP can be authenticated.
- Agents can connect to multiple MCP servers.
- Cloud.ru documentation lists connectors/skills in Agents Space for development/code management, email, calendar and cloud files.
- Cloud.ru documents preview/free models in its model catalog, but the AI Agents service itself is pay-as-you-go. Therefore “free model” does NOT mean “free always-on agent infrastructure”.

## Pricing truth
- Agents Space is pay-as-you-go for vCPU/RAM and model tokens. Current documentation gives a base configuration of 2 vCPU + 4 GB RAM at 3.84 RUB/hour while the agent is running, plus model token charges. Storage has a 15 GB free tier.
- AI Agents is also pay-as-you-go for compute; dependent model/storage services may add charges.
- Cloud.ru documentation for Evolution currently advertises a 4,000-bonus starting grant and free-tier services, but eligibility and remaining balance must be checked in the user's Cloud.ru account before treating it as free for this project.

## Proposed architecture
User -> Alice/Web -> My AI Unified Dispatcher

Dispatcher decides:
1. Local/VPS module when the task is already implemented locally.
2. Cloud.ru agent when Cloud.ru provides a better external tool/agent.
3. MCP service when a structured external tool is needed.
4. Existing shopping/search/vision/document modules when they are more reliable.

Cloud.ru must be hidden behind the Dispatcher. The user should not need to know where a capability runs.

## First integration candidate
Do NOT migrate the whole project.

Phase 1: create one Cloud.ru agent/system as a controlled experiment.
- Prefer a low-cost or preview model if available.
- Prefer a serverless/zero-minimum-instance configuration where supported.
- Connect one useful MCP server or catalog agent.
- Obtain its public endpoint.
- From My AI Unified, call it through a small adapter with timeout, error handling and fallback.
- Keep secrets only in VPS environment variables or Cloud.ru secret mechanisms; never commit keys.

## Recommended first tests
A. Web/search specialist: ask for current factual information and compare with our existing web-search path.
B. Document/RAG specialist: test a small project knowledge base without moving the whole application.
C. Development/GitHub tool only after the first two tests are stable.

## Do not do yet
- Do not replace the main Dispatcher with Cloud.ru.
- Do not move Alice to Cloud.ru.
- Do not move the shopping API to Cloud.ru.
- Do not add a paid always-on agent merely to test the idea.
- Do not pull a larger local model on the VPS while disk usage is about 92%.

## Acceptance criteria
Cloud.ru is considered useful only if a real request from My AI Unified can be routed to the Cloud.ru capability, receive a correct result, return through the Dispatcher, and fall back to the existing local path on Cloud.ru failure or timeout.

## Sources
- Cloud.ru AI Agents overview and features: https://cloud.ru/docs/ai-agents/ug/topics/overview__features
- Create AI agent: https://cloud.ru/docs/ai-agents/ug/topics/guides__create-agent
- Create agent system: https://cloud.ru/docs/ai-agents/ug/topics/guides__create-assistant
- Create MCP server: https://cloud.ru/docs/ai-agents/ug/topics/guides__create-mcp-server
- AI Agents API authentication: https://cloud.ru/docs/ai-agents/ug/topics/api-ref__authentication
- AI Agents pricing: https://cloud.ru/docs/ai-agents/ug/topics/pricing
- Agents Space pricing: https://cloud.ru/docs/ai-agents/ug/topics/concepts__pricing
- Agents Space: https://cloud.ru/agents-space
