# 007 — MD5 for dirty detection

**Status:** Accepted  
**Date:** 2026-04-17

## Context

Cortex tracks whether a destination file has been manually edited since the last sync. This requires hashing file content and storing the hash for comparison on the next run.

## Decision

Use MD5 via `node:crypto`. Hashes are stored as hex strings in `~/.cortex/hashes.json`, keyed by normalized destination path.

## Consequences

**Gained:**
- Fast — MD5 is the fastest general-purpose hash available in `node:crypto`
- Compact output — 32-character hex string per file
- No external dependency — built into Node.js
- Sufficient for change detection (collision resistance not required here)

**Lost:**
- Nothing meaningful. MD5 is not used for security — its cryptographic weaknesses are irrelevant for this use case. SHA-256 would work identically but be slower.
