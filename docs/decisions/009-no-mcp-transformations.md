# 009 — No MCP transformations per platform

**Status:** Accepted  
**Date:** 2026-04-17

## Context

Different platforms could theoretically require different MCP config structures. A transformation layer would allow Cortex to reformat server definitions per platform before writing.

## Decision

No transformation layer. The same server definition from `cortex.toml` is written as-is to every platform config. The `mcpKey` field handles the only known structural difference (the JSON key name).

## Consequences

**Gained:**
- No complexity for a problem that doesn't exist yet
- The `mcpKey` field already handles per-platform key name differences
- If a future platform requires a different structure, a `mcpTransform` function can be added at that point without breaking the existing schema

**Lost:**
- If a platform requires a genuinely different MCP structure, this will need revisiting

**Principle:** don't build abstractions for problems that don't exist yet.
