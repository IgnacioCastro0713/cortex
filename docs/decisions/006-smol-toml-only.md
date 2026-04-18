# 006 — smol-toml as the only dependency

**Status:** Accepted  
**Date:** 2026-04-17

## Context

Cortex is a globally-installed developer tool. Dependencies installed globally can conflict with other tools and increase supply chain risk. Node.js doesn't provide native TOML parsing.

TOML was chosen as the configuration format over JSON and YAML because it is easier to read and write by hand — comments are supported, multiline strings are natural, and the `[section.key]` syntax maps cleanly to Cortex's nested structure (skills, agents, MCP servers). JSON requires escaping and doesn't allow comments; YAML's indentation-sensitivity causes hard-to-debug errors.

## Decision

Use only `smol-toml` as a runtime dependency. Everything else — hashing, filesystem, git, CLI argument parsing, terminal colors — uses Node.js built-in APIs (`node:crypto`, `node:fs/promises`, `node:child_process`, `node:util`, etc.).

## Consequences

**Gained:**
- Minimal supply chain surface — one dependency to audit
- Fast install — `npm install -g` downloads almost nothing
- Fewer version conflicts with other globally-installed packages
- `smol-toml` is small, well-tested, and purpose-built

**Lost:**
- More verbose code in places where a library would be ergonomic (e.g., terminal colors require `styleText` instead of `chalk`)
- Must implement things like tree rendering, atomic writes, and argument parsing from scratch
