# 003 — MCP merge strategy instead of replace

**Status:** Accepted  
**Date:** 2026-04-17

## Context

The initial MCP implementation replaced the entire `mcpServers` key in the platform config with the servers defined in `cortex.toml`. This was simple but destructive.

## Decision

Use a merge strategy: `{ ...existingServers, ...cortexServers }`. Cortex-managed servers are added or updated; servers not in `cortex.toml` are left untouched. All other keys in the JSON file (e.g., `theme`) are also preserved.

**Merge rules:**
- User-defined servers not in `cortex.toml` → preserved
- Servers in `cortex.toml` not in existing config → added
- Servers in both → Cortex wins (updated to match TOML)
- All other keys in the JSON file → preserved

## Consequences

**Gained:**
- Non-destructive — users can define platform-specific MCP servers outside Cortex without losing them on the next sync
- Safe to run repeatedly — idempotent

**Lost:**
- Cortex cannot remove a server from platform configs by deleting it from `cortex.toml`. Decommissioned servers require manual cleanup from the platform JSON.
