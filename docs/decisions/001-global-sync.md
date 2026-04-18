# 001 — Global sync instead of per-project

**Status:** Accepted  
**Date:** 2026-04-17

## Context

Earlier versions of Cortex copied files into the project directory (`.github/`, `.gemini/`). This required running `cortex sync` inside each repository and meant knowledge files lived in N project directories instead of one place.

## Decision

Sync everything to global platform directories (`~/.copilot/`, `~/.gemini/`, `~/.claude/`) in the user's home directory. The manifest at `~/.cortex/cortex.toml` is also global.

## Consequences

**Gained:**
- Single source of truth — skills and agents are user-level knowledge, not project configuration
- No project setup required — open any folder in your editor and the assistant already has your instructions
- Consistent mental model with MCP, which was already global
- Simpler implementation — `cwd` parameter removed entirely from the sync pipeline

**Lost:**
- Cannot have per-project knowledge overrides via Cortex (intentional — use the platform's own override mechanisms for that)
