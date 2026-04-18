# 008 — Atomic writes everywhere

**Status:** Accepted  
**Date:** 2026-04-17

## Context

All file writes in Cortex — skill/agent copies, hash DB saves, MCP config updates — could be interrupted mid-write by a crash, power loss, or signal. A partial write would corrupt the file.

## Decision

Every write goes through a tmp-file-then-rename pattern:
1. Write full content to `<target>.tmp`
2. `fs.rename(tmp, target)` — atomic on all major filesystems

## Consequences

**Gained:**
- Files are never left in a partial/corrupt state — the rename is atomic, so the target either has the old content or the new content, never something in between
- Safe to interrupt `cortex sync` at any point

**Lost:**
- Slightly more complex write logic (two operations instead of one)
- Requires the tmp file to be on the same filesystem as the target (always true here since they share the same directory)
