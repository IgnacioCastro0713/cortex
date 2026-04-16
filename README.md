# Cortex

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org)
[![Version](https://img.shields.io/badge/version-0.0.1-orange.svg)](package.json)

> **Write your AI knowledge once. Distribute it everywhere.**

A CLI that centralizes your AI coding assistant knowledge (custom agents and skills) in one place and distributes it across all your projects via symlinks.

## Install

```sh
npm install -g @ignacioCastro0713/cortex
```

## Quick start

```sh
# 1. Install globally (one time)
cortex init
code $HOME/.cortex/cortex.toml   # edit platforms, paths, and deps
```

```sh
# 2. Sync into any project (per project)
cd your-project
cortex sync
```

## How it works

```
 YOUR KNOWLEDGE (single source of truth)     YOUR PROJECTS (symlinks, always in sync)
 ─────────────────────────────────────────    ─────────────────────────────────────────

 ~/.cortex/ai/                                project-a/.github/
   agents/                                      agents/
     code-review.agent.md  ◄──────────────────    code-review.agent.md
   skills/                                      skills/
     planning/             ◄──────────────────    planning/
     implementation/       ◄──────────────────    implementation/

                                              project-b/.github/
                                                agents/
                                                  code-review.agent.md  (same link)
                                                skills/
                                                  planning/             (same link)
                                                  implementation/       (same link)
```

Edit the source once → every project sees the change instantly.

Cortex maintains a master knowledge repository at `~/.cortex/ai/`. When you run `cortex sync` inside any project, it creates symlinks into the platform-specific directories that AI coding assistants read (`.github/` for Copilot, `.gemini/` for Gemini).

## Features

- **Write once** — Define your agents and skills as `.md` files in `~/.cortex/ai/`.
- **Share easily** — Pull third-party skills from Git repositories as dependencies.
- **Sync everywhere** — Run `cortex sync` in any project to create symlinks that point back to your master files.
- **Stay in sync** — Edit the source and every project sees the change instantly. No copying, no drift.

## Commands

| Command | Description |
|---------|-------------|
| `cortex init` | Generate `~/.cortex/cortex.toml` and ensure `~/.cortex/ai/` structure exists |
| `cortex update` | Pull latest changes for `~/.cortex/ai/` and all deps |
| `cortex sync` | Create symlinks from knowledge sources into the current project |
| `cortex list` | Show the map of linked files (flags broken sources with ⚠) |
| `cortex clean` | Remove all cortex-managed symlinks from the current project |

### Options

| Flag | Short | Description |
|------|-------|-------------|
| `--dry-run` | `-d` | Preview `sync` without creating or removing any symlinks |
| `--version` | `-v` | Print the current version and exit |
| `--help` | `-h` | Show the help message |

## Configuration

The file `~/.cortex/cortex.toml` controls everything:

```toml
platforms = [ "copilot", "gemini"]

[deps]
design-doc-mermaid = "https://github.com/SpillwaveSolutions/design-doc-mermaid"

[skills]
paths = [ "~/.cortex/ai/skills/*" , "@design-doc-mermaid"]

[agents]
paths = [ "~/.cortex/ai/agents/*" ]
```

### Path prefixes

| Prefix | Resolves to |
|--------|-------------|
| `~` | User home directory |
| `@alias` | `~/.cortex/deps/{alias}` |
| `./` | Current working directory |

### Platforms

| Platform | Target directory |
|----------|-----------------|
| `copilot` | `.github/` |
| `gemini` | `.gemini/` |

## Why

AI coding assistants like GitHub Copilot and Google Gemini read project-specific instructions from local directories (`.github/` and `.gemini/`). When you have multiple projects, you end up duplicating the same agent definitions and skill prompts across each one. Keeping them in sync is manual, error-prone, and doesn't scale.

## Requirements

- Node.js >= 22
- Git (for `cortex update`)
- Windows: [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development) enabled (Settings → System → For developers → On)

## Project structure

```
src/
  index.ts        Entry point and argument parsing
  constants.ts    Shared paths and platform mappings
  resolver.ts     Config resolution and entry deduplication
  parser.ts       TOML config reader/writer
  fs-utils.ts     Filesystem operations (symlinks, glob, path expansion)
  git-utils.ts    Git wrapper (clone, pull)
  log.ts          Colored terminal output via util.styleText()
  commands/
    init.ts       cortex init
    update.ts     cortex update
    sync.ts       cortex sync
    list.ts       cortex list
    clean.ts      cortex clean
test/
  fs-utils.test.ts
  fs-utils-io.test.ts
  resolver.test.ts
  parser.test.ts
  git-utils.test.ts
  commands/
    init.test.ts
    sync.test.ts
    list.test.ts
    clean.test.ts
    update.test.ts
```

## License

MIT — see [LICENSE](LICENSE) for details.

---

Built with Node.js native TypeScript execution — zero build step, zero bundler.
