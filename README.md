# Cortex

[![npm version](https://img.shields.io/npm/v/@ignaciocastro0713/cortex.svg)](https://www.npmjs.com/package/@ignaciocastro0713/cortex)
[![npm downloads](https://img.shields.io/npm/dt/@ignaciocastro0713/cortex.svg)](https://www.npmjs.com/package/@ignaciocastro0713/cortex)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> **Write your AI knowledge once. Distribute it everywhere.**

AI coding assistants like GitHub Copilot and Gemini read project-specific instructions from local directories (`.github/` for Copilot, `.gemini/` for Gemini). If you work across multiple projects, you end up copying the same agent definitions and skill prompts everywhere — keeping them in sync is tedious and error-prone.

Cortex solves this by storing your knowledge in one central place (`~/.cortex/ai/`) and copying it into each project on sync. Edit the source once — run `cortex sync` to propagate the changes everywhere.

## Install

```sh
npm install -g @ignaciocastro0713/cortex
```

> **Requirements:** Node.js >= 22 · Git (for `cortex update`)

## Quick start

### 1. Initialize (run once)

```sh
cortex init
```

Creates the following structure in your home directory:

```
~/.cortex/
  cortex.toml       ← configuration file
  ai/
    agents/         ← AI agent definitions (.md files)
    skills/         ← skill and instruction prompts (.md files)
  deps/             ← third-party knowledge cloned from Git
```

### 2. Add your knowledge files

Create `.md` files in `~/.cortex/ai/agents/` and `~/.cortex/ai/skills/`. These are plain Markdown files that your AI assistant will read as instructions.

**Example — `~/.cortex/ai/agents/code-review.md`:**
```markdown
# Code Review Agent
Review code for correctness, edge cases, and style issues.
Always suggest tests for uncovered paths.
```

**Example — `~/.cortex/ai/skills/testing.md`:**
```markdown
# Testing Skill
Write unit tests using the AAA pattern (Arrange, Act, Assert).
Prefer pure functions and avoid mocking unless necessary.
```

### 3. Configuration

`~/.cortex/cortex.toml` controls everything:

```toml
platforms = ["copilot", "gemini"]

[deps]
# Clone a third-party knowledge repo as a dependency
design-doc-mermaid = "https://github.com/SpillwaveSolutions/design-doc-mermaid"

[skills]
paths = [
  "~/.cortex/ai/skills/*",   # your own skills
  "@design-doc-mermaid",     # all files from the dep above
]

[agents]
paths = ["~/.cortex/ai/agents/*"]
```

### 4. Sync into a project

```sh
cd your-project
cortex sync
```

Cortex copies your files into `.github/` (Copilot) and `.gemini/` (Gemini). Run this in every project you want to equip. Only files managed by Cortex are overwritten — files you created manually are left untouched. If Cortex previously synced a file and you've edited it locally, that file is skipped with a warning; use `--force` to overwrite it.

## How it works

```mermaid
graph TB
    Source["🧠 ~/.cortex/ai/
    ─────────────────
    agents/
      └─ code-review.md
    skills/
      ├─ planning/
      └─ implementation/"]

    subgraph cortex sync
        CMD["cortex sync"]
    end

    Source -->|copies| CMD

    CMD --> PA["project-a/
    .github/
      agents/
      skills/"]

    CMD --> PB["project-b/
    .github/
      agents/
      skills/"]

    CMD --> PC["project-c/
    .gemini/
      agents/
      skills/"]

    style Source fill:#2d5a27,color:#fff,stroke:#4a9e42
    style CMD fill:#1a3a5c,color:#fff,stroke:#2e6da4
```

## Commands

| Command | Description |
|---------|-------------|
| `cortex init` | Create `~/.cortex/cortex.toml` and the `~/.cortex/ai/` folder structure |
| `cortex sync` | Copy knowledge files into the current project (hash-tracked, skips locally modified files) |
| `cortex list` | Show the map of linked files (flags broken sources with ⚠) |
| `cortex clean` | Remove all cortex-managed files from the current project |
| `cortex update` | Pull latest changes for `~/.cortex/ai/` and all deps |

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-d` | Preview `sync` without making any changes |
| `--force` | `-f` | Overwrite locally modified files during `sync` |
| `--version` | `-v` | Print the current version and exit |
| `--help` | `-h` | Show the help message |

## Configuration reference

### Path prefixes

| Prefix | Resolves to |
|--------|-------------|
| `~` | User home directory |
| `@alias` | `~/.cortex/deps/{alias}` (a cloned dependency) |
| `./` | Current working directory |

### Platforms

| Platform | Files copied to |
|----------|---------------------|
| `copilot` | `.github/` |
| `gemini` | `.gemini/` |

## Project structure

```
src/
  index.ts        Entry point and argument parsing
  constants.ts    Shared paths and platform definitions
  resolver.ts     Config resolution and entry deduplication
  parser.ts       TOML config reader/writer
  fs-utils.ts     Filesystem operations (copy, glob, path expansion)
  git-utils.ts    Git wrapper (clone, pull)
  log.ts          Colored terminal output via util.styleText()
  commands/
    init.ts
    update.ts
    sync.ts
    list.ts
    clean.ts
test/
  commands/
    init.test.ts
    sync.test.ts
    list.test.ts
    clean.test.ts
    update.test.ts
  fs-utils.test.ts
  fs-utils-io.test.ts
  resolver.test.ts
  parser.test.ts
  git-utils.test.ts
```

## License

MIT — see [LICENSE](LICENSE) for details.
