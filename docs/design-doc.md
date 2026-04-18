# Cortex — Design Doc

## Goal

Keep AI coding agent knowledge in sync across tools and projects. One manifest, distributed to every platform that needs it. Nothing more.

Cortex is deliberately minimal — it syncs knowledge files and MCP configs. It does one thing well and stays out of the way.

## Problem

Each AI coding assistant expects knowledge files in different locations:

| Assistant       | Directory   |
|-----------------|-------------|
| GitHub Copilot  | `.github/`  |
| Gemini CLI      | `.gemini/`  |

If you use both assistants across multiple projects, you end up duplicating the same agent definitions and skill prompts everywhere. Any edit means visiting every project — tedious and error-prone.

## Solution

Cortex is a CLI tool that reads a single TOML manifest (`~/.cortex/cortex.toml`) and distributes knowledge files to the right locations per platform. It also syncs MCP server definitions to each platform's global config file.

## Core Concepts

- **Manifest** (`~/.cortex/cortex.toml`) — global config file that lives at `~/.cortex/`. Declares platforms, deps, skills, agents, and MCP servers.
- **Skills** — prompt files that agents consume. Copied to each platform's target directory within the project.
- **Agents** — subagent definitions. Same copy strategy as skills.
- **Dependencies** — external git repos cloned to `~/.cortex/deps/`. Referenced in paths via `@name` prefix. Clone-only — updated explicitly via `cortex update`, never during `cortex sync`.
- **MCP Servers** — Model Context Protocol server definitions. Written to each platform's global config file (not per-project). Cortex owns the `mcpServers` key completely.
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
| `./`     | Current working directory                |

## Platform Definitions

Defined in source code, not configurable by the user.

| Platform | Skills/Agents target | MCP config file                | MCP key        |
|----------|----------------------|--------------------------------|----------------|
| Copilot  | `.github/`           | `~/.copilot/mcp-config.json`  | `mcpServers`   |
| Gemini   | `.gemini/`           | `~/.gemini/settings.json`     | `mcpServers`   |

## CLI Commands

| Command         | Description                                                           |
|-----------------|-----------------------------------------------------------------------|
| `cortex init`   | Scaffold `~/.cortex/cortex.toml` and directory structure              |
| `cortex sync`   | Copy knowledge files into the current project + sync MCP configs      |
| `cortex list`   | Show the map of knowledge sources configured in `cortex.toml`         |
| `cortex clean`  | Remove all cortex-managed files from the current project              |
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

Cortex owns the `mcpServers` key in each platform's config file completely. The TOML is the single source of truth.

1. Read the existing JSON config file (if any).
2. Replace the entire `mcpServers` key with all resolved MCP definitions from the TOML.
3. Preserve all other keys in the file untouched.
4. Write atomically (tmp file + rename).

MCP configs are **global** — they live in the user's home directory, not inside the project. This is because MCP servers are tools available to the assistant regardless of project context.

---

## Design Decisions

### Why copies instead of symlinks?

Symlinks were used in earlier versions but replaced with file copies for several reasons:

1. **Windows compatibility.** Creating symlinks on Windows requires either Administrator privileges or Developer Mode enabled. This is a non-starter for most users — copies work everywhere without special permissions.

2. **Git-friendly.** Symlinks committed to git are fragile across clones and platforms. A symlink pointing to `~/.cortex/ai/skills/planning/` breaks on any machine with a different home directory. Copies are self-contained.

3. **Dirty detection.** With copies, Cortex can hash the destination file and detect if the user has manually edited it. This enables the skip-with-warning behavior. With symlinks, there is no "destination file" to hash — the symlink just points to the source. Any edit to the symlinked file modifies the source directly, which is dangerous when the same source feeds multiple projects.

4. **Stale removal is safe.** Deleting a copied file is a no-op if the user has moved on. Deleting a symlink that might still be referenced elsewhere is riskier.

The tradeoff is disk usage and sync time, both negligible for markdown files.

### Why no MCP transformations per platform?

Both Copilot CLI and Gemini CLI currently use the same `mcpServers` structure:

```json
{
  "mcpServers": {
    "name": {
      "command": "...",
      "args": ["..."],
      "env": {}
    }
  }
}
```

Introducing a transformation layer would add complexity without a concrete use case today. If a future platform requires a different MCP structure, the `mcpKey` field in the platform definition already allows per-platform key names, and a `mcpTransform` function can be added at that point without breaking the existing schema.

Principle: **don't build abstractions for problems that don't exist yet.**

### Why separate `cortex sync` from `cortex update`?

Sync should be fast and predictable — it reads local files and writes local files. Pulling git repos is slow and network-dependent. Users update deps explicitly when they want to (`cortex update`), and sync uses whatever is already on disk. This keeps `cortex sync` safe to run in CI or pre-commit hooks without network access.

### Why `smol-toml` as the only dependency?

Cortex is a developer tool that users install globally. Minimal dependencies mean fewer supply chain risks, faster installs, and fewer version conflicts. `smol-toml` is small, well-tested, and handles the TOML parsing/stringifying that Node.js doesn't provide natively. Everything else — hashing, filesystem, git, CLI parsing, terminal colors — uses Node.js built-in APIs.

### Why MD5 for hashing?

MD5 is not used for security — it's used for change detection. It's fast, produces compact hex strings, and is built into Node.js (`node:crypto`). SHA-256 would work identically but be slower for no benefit in this context.

### Why atomic writes?

Every file write (copies, hash DB, MCP configs) goes through a tmp-file-then-rename pattern. This prevents partial writes from corrupting files if the process is interrupted. The rename operation is atomic on all major filesystems.

### Why `mcpKey` per platform?

Both platforms currently use `mcpServers` as the key, but this is a coincidence of the current moment. Having `mcpKey` as a platform-level field means adding a new platform with a different key name requires zero code changes — just a new entry in the `PLATFORMS` array.

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
    clean.ts                Remove managed files from project
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
