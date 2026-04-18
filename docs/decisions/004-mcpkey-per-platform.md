# 004 — mcpKey per platform

**Status:** Accepted  
**Date:** 2026-04-17

## Context

Each platform's MCP config file uses a JSON key to identify the MCP servers block. Both Copilot and Gemini currently use `"mcpServers"`, but this is a coincidence — future platforms may use different key names.

## Decision

Store the key name as `mcpKey` on each platform definition in `constants.ts`. The MCP sync logic reads `platform.mcpKey` rather than hardcoding a string.

## Consequences

**Gained:**
- Adding a new platform with a different MCP key requires zero code changes — just a new entry in `PLATFORMS`
- Explicit documentation of what each platform expects

**Lost:**
- Slightly more verbose platform definitions (one extra field)
