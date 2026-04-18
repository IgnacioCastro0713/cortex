# Cortex — Design Doc

## Goal

Keep AI coding agent knowledge in sync across tools and projects. One manifest, distributed to every platform that needs it. Nothing more.

Cortex is deliberately minimal — it syncs knowledge files and MCP configs. It does one thing well and stays out of the way.

## Problem

Each AI coding assistant expects knowledge files in different locations:

| Assistant       | Global directory  |
|-----------------|-------------------|
| GitHub Copilot  | `~/.copilot/`    |
| Gemini CLI      | `~/.gemini/`     |

If you use both assistants across multiple projects, you end up duplicating the same agent definitions and skill prompts everywhere. Any edit means visiting every project — tedious and error-prone.

## Solution

Cortex is a CLI tool that reads a single TOML manifest (`~/.cortex/cortex.toml`) and distributes knowledge files to each platform's global directory. It also syncs MCP server definitions to each platform's config file.

## Core Concepts

- **Manifest** (`~/.cortex/cortex.toml`) — global config file that lives at `~/.cortex/`. Declares platforms, deps, skills, agents, and MCP servers.
- **Skills** — prompt files that agents consume. Copied to each platform's global directory (`~/.copilot/skills/`, `~/.gemini/skills/`).
- **Agents** — subagent definitions. Same copy strategy as skills.
- **Dependencies** — external git repos cloned to `~/.cortex/deps/`. Referenced in paths via `@name` prefix. Clone-only — updated explicitly via `cortex update`, never during `cortex sync`.
- **MCP Servers** — Model Context Protocol server definitions. Merged into each platform's config file. Cortex-managed servers are added or updated; user-defined servers are preserved.
- **Hash DB** (`~/.cortex/hashes.json`) — stores MD5 hashes of last-synced content per target file. Enables dirty detection before overwriting.

## TOML Schema

```toml
platforms = ["copilot", "gemini"]

[deps]
design-doc-mermaid = "https://github.com/SpillwaveSolutions/design-doc-mermaid"

[skills]
paths = [
  "~/.cortex/ai/skills/*",
  "@design-doc-mermaid",
]

[agents]
paths = ["~/.cortex/ai/agents/*"]

[mcp.playwright]
command = "npx"
args = ["@playwright/mcp@latest"]

[mcp.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env = { CONTEXT7_API_KEY = "$CONTEXT7_API_KEY" }
```

### Path Resolution

| Prefix   | Resolves to                              |
|----------|------------------------------------------|
| `~`      | User home directory                      |
| `@name`  | `~/.cortex/deps/{name}/`                 |

## Platform Definitions

Defined in source code, not configurable by the user.

| Platform | Target directory    | MCP config file                | MCP key        |
|----------|---------------------|--------------------------------|----------------|
| Copilot  | `~/.copilot/`      | `~/.copilot/mcp-config.json`  | `mcpServers`   |
| Gemini   | `~/.gemini/`       | `~/.gemini/settings.json`     | `mcpServers`   |

## CLI Commands

| Command         | Description                                                           |
|-----------------|-----------------------------------------------------------------------|
| `cortex init`   | Scaffold `~/.cortex/cortex.toml` and directory structure              |
| `cortex sync`   | Copy knowledge files to global platform directories + sync MCP configs|
| `cortex list`   | Show the map of knowledge sources configured in `cortex.toml`         |
| `cortex clean`  | Remove all cortex-managed files from platform directories             |
| `cortex update` | Pull latest changes for `~/.cortex/ai/` and all deps                 |

### Flags

| Flag         | Short | Applies to | Description                                  |
|--------------|-------|------------|----------------------------------------------|
| `--dry-run`  | `-d`  | `sync`     | Preview without writing                      |
| `--force`    | `-f`  | `sync`     | Overwrite locally modified files              |
| `--version`  | `-v`  | global     | Print version                                |
| `--help`     | `-h`  | global     | Print help                                   |

## Sync Flow

```
~/.cortex/cortex.toml
         │
         ▼
   ┌───────────┐
   │   parse   │  Read TOML, resolve paths, expand globs
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │   hash    │  Compare source hash vs stored hash per file
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │   copy    │  Atomic write (tmp + rename) per file
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │   stale   │  Remove files no longer in config, clean empty dirs
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │   mcp     │  Merge mcpServers into platform JSON configs
   └─────┬─────┘
         │
         ▼
   ┌───────────┐
   │   save    │  Update hash DB
   └───────────┘
```

## Dirty Detection

- On every sync, Cortex hashes the source file (MD5) and stores it in `~/.cortex/hashes.json` keyed by destination path.
- Before overwriting a target file, Cortex reads the target, hashes it, and compares against the stored hash.
- **Match** → file untouched since last sync, safe to overwrite.
- **Mismatch** → file was manually edited. Skipped with `⚠` warning unless `--force` is used.
- **Missing hash** → file exists on disk but wasn't synced by Cortex. Skipped (not managed).
- `--force` skips all dirty checks and overwrites everything.

## Stale File Removal

When a file is removed from the TOML config, Cortex detects it by comparing the expected set of destination paths against the keys in the hash DB. Files present in the hash DB but absent from the expected set are deleted from disk. Empty directories are cleaned up recursively, but only if they contain no files outside of Cortex's management.

## MCP Sync Strategy

Cortex uses a **merge strategy** for MCP configs: Cortex-managed servers are added or updated, while user-defined servers in the platform config file are preserved. All writes are atomic (tmp file + rename).

For the full MCP design — data model, merge flow diagrams, filter flags, and edge cases — see [mcp-sync-design.md](mcp-sync-design.md).

---

## Design Decisions

Architecture decisions are documented as ADRs in [`docs/decisions/`](decisions/).

| ADR | Decision |
|-----|----------|
| [001](decisions/001-global-sync.md) | Global sync instead of per-project |
| [002](decisions/002-copies-vs-symlinks.md) | File copies instead of symlinks |
| [003](decisions/003-mcp-merge-strategy.md) | MCP merge strategy instead of replace |
| [004](decisions/004-mcpkey-per-platform.md) | `mcpKey` per platform |
| [005](decisions/005-separate-sync-update.md) | Separate `cortex sync` from `cortex update` |
| [006](decisions/006-smol-toml-only.md) | `smol-toml` as the only dependency |
| [007](decisions/007-md5-for-hashing.md) | MD5 for dirty detection |
| [008](decisions/008-atomic-writes.md) | Atomic writes everywhere |
| [009](decisions/009-no-mcp-transformations.md) | No MCP transformations per platform |

---

## Folder Structure

```
~/.cortex/
  cortex.toml               ← global config
  hashes.json               ← hash DB for dirty detection
  ai/
    agents/                 ← agent definitions (.md)
    skills/                 ← skill prompts (.md)
  deps/                     ← cloned git dependencies
```

## Source Structure

```
src/
  index.ts                  CLI entry point, argument parsing
  core/
    constants.ts            Shared paths, platform definitions
    hash-db.ts              MD5 hash tracking (load, save, isDirty)
    mcp.ts                  MCP config merge into platform JSON files
    parser.ts               TOML config reader/writer
    resolver.ts             Path resolution, glob expansion, deduplication
  utils/
    fs-utils.ts             Filesystem ops (copy, glob, expandPath, removeEmptyDirs)
    git-utils.ts            Git clone/pull wrapper
    log.ts                  Colored terminal output (node:util styleText)
    tree.ts                 ASCII tree renderer
  commands/
    init.ts                 Scaffold ~/.cortex/ structure
    update.ts               Pull ai/ and deps
    sync.ts                 Copy files + sync MCPs
    list.ts                 Show configured knowledge map
    clean.ts                Remove managed files from platform directories
```

## Tech Stack

- **Runtime:** Node.js >= 22 (native TypeScript execution via type stripping)
- **Language:** TypeScript 5.7+ (ESM, no bundler)
- **Dependency:** `smol-toml` (TOML parsing/stringifying)
- **Terminal UI:** `node:util` `styleText` (no third-party TUI libraries)
- **Testing:** `node:test` + `node:assert`
- **Distribution:** npm (`@ignaciocastro0713/cortex`), single `dist/` build via `tsc`

## Open Questions

- Should `cortex update` support pinning deps to a specific commit/tag?
- Should there be a `cortex mcp` subcommand for managing MCP entries without editing TOML?

## Future Considerations

### Project-level sync

Currently Cortex operates at the **user level** — global config in `~/.cortex/`, synced into each platform's global directory. A natural extension is **project-level sync**: reading a `cortex.toml` at the repo root and syncing into project-scoped platform directories instead of (or in addition to) the global ones.

Each platform has a project-level directory where skills and agents can be placed:

| Platform | Global (current) | Project-level (not yet supported) |
|----------|-----------------|-----------------------------------|
| Copilot | `~/.copilot/` | `.github/prompts/` |
| Gemini | `~/.gemini/` | `.gemini/` in project root |
| Claude | `~/.claude/commands/` | `.claude/commands/` in project root |

Cortex does not currently read a `cortex.toml` from the repo root or sync into project directories. All sync targets are global.

**Why this would be useful:** project-level skills and agents carry repo-specific context — architecture conventions, testing patterns, domain language — that doesn't belong in the global config shared across all machines and projects.

**Two composition models under consideration:**

1. **Standalone project mode** — `cortex sync` detects a local `cortex.toml` and resolves all paths relative to the project. Global and project syncs are independent runs.
2. **Global + project composition** — the global `~/.cortex/cortex.toml` defines shared knowledge; the local `cortex.toml` extends or overrides it per repo. Personal coding style stays global, repo conventions stay local.

The composition model is more powerful but requires clear merge semantics — particularly whether project entries append to or replace global entries of the same name.
