import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for the sync filter flag logic.
 * Rule: if no filter flags → sync everything. If any flag → only flagged items.
 */

interface FilterFlags {
  skills?: boolean;
  agents?: boolean;
  mcp?: boolean;
}

/** Replicates the filter resolution logic from sync.ts */
function resolveFilters(options: FilterFlags) {
  const hasFilter = !!(options.skills || options.agents || options.mcp);
  return {
    syncSkills: !hasFilter || !!options.skills,
    syncAgents: !hasFilter || !!options.agents,
    syncMcp:    !hasFilter || !!options.mcp,
  };
}

describe("sync filter flags", () => {
  it("no flags → sync everything", () => {
    const result = resolveFilters({});
    assert.deepEqual(result, { syncSkills: true, syncAgents: true, syncMcp: true });
  });

  it("--skills → only skills", () => {
    const result = resolveFilters({ skills: true });
    assert.deepEqual(result, { syncSkills: true, syncAgents: false, syncMcp: false });
  });

  it("--agents → only agents", () => {
    const result = resolveFilters({ agents: true });
    assert.deepEqual(result, { syncSkills: false, syncAgents: true, syncMcp: false });
  });

  it("--mcp → only MCP", () => {
    const result = resolveFilters({ mcp: true });
    assert.deepEqual(result, { syncSkills: false, syncAgents: false, syncMcp: true });
  });

  it("--skills --agents → skills + agents, no MCP", () => {
    const result = resolveFilters({ skills: true, agents: true });
    assert.deepEqual(result, { syncSkills: true, syncAgents: true, syncMcp: false });
  });

  it("--skills --mcp → skills + MCP, no agents", () => {
    const result = resolveFilters({ skills: true, mcp: true });
    assert.deepEqual(result, { syncSkills: true, syncAgents: false, syncMcp: true });
  });

  it("--agents --mcp → agents + MCP, no skills", () => {
    const result = resolveFilters({ agents: true, mcp: true });
    assert.deepEqual(result, { syncSkills: false, syncAgents: true, syncMcp: true });
  });

  it("all three flags → sync everything", () => {
    const result = resolveFilters({ skills: true, agents: true, mcp: true });
    assert.deepEqual(result, { syncSkills: true, syncAgents: true, syncMcp: true });
  });

  it("explicit false values → sync everything (same as no flags)", () => {
    const result = resolveFilters({ skills: false, agents: false, mcp: false });
    assert.deepEqual(result, { syncSkills: true, syncAgents: true, syncMcp: true });
  });
});
