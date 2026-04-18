# 005 — Separate `cortex sync` from `cortex update`

**Status:** Accepted  
**Date:** 2026-04-17

## Context

An early design combined dependency pulling and file syncing into a single command. Users would run one command that fetched the latest from git repos and then copied files.

## Decision

Split into two separate commands:
- `cortex sync` — reads local files and writes local files. No network access.
- `cortex update` — pulls `~/.cortex/ai/` and all deps from their git remotes.

## Consequences

**Gained:**
- `cortex sync` is fast and predictable — no network dependency
- Safe to run in CI, pre-commit hooks, or startup scripts without network access
- Users control when deps are updated (explicitly, intentionally)
- Failure modes are isolated — a broken git remote doesn't break file sync

**Lost:**
- Users must remember to run `cortex update` separately when they want fresh deps
