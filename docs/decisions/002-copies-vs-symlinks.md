# 002 — File copies instead of symlinks

**Status:** Accepted  
**Date:** 2026-04-17

## Context

The first implementation used symlinks to avoid duplicating file content on disk. Symlinks were created inside each platform directory pointing back to `~/.cortex/ai/`.

Gemini CLI's skill/agent discovery does follow symlinks correctly — symlinks would technically work for that platform. However, the decision was made globally because Windows compatibility and dirty detection outweighed the marginal benefit of keeping symlinks on Unix-only platforms.

## Decision

Replace symlinks with atomic file copies.

## Consequences

**Gained:**
- **Windows compatibility** — creating symlinks on Windows requires Administrator privileges or Developer Mode. Copies work everywhere without special permissions.
- **Git-friendly** — symlinks committed to git are fragile across clones and platforms. A symlink pointing to `~/.cortex/ai/skills/planning/` breaks on any machine with a different home directory. Copies are self-contained.
- **Dirty detection** — with copies, Cortex can hash the destination file and detect if the user has manually edited it, enabling the skip-with-warning behavior. With symlinks, editing the "destination" modifies the source directly.
- **Safe stale removal** — deleting a copied file is safe. Deleting a symlink that might still be referenced elsewhere is riskier.

**Lost:**
- Slightly more disk usage and sync time — negligible for markdown files.
