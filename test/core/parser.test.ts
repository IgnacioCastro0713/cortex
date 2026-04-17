import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse, stringify } from "smol-toml";
import { defaultConfig } from "../../src/core/parser.ts";
import type { CortexConfig } from "../../src/core/parser.ts";

describe("defaultConfig", () => {
  it("returns copilot as default platform", () => {
    const config = defaultConfig();
    assert.deepEqual(config.platforms, ["copilot"]);
  });

  it("has empty deps", () => {
    const config = defaultConfig();
    assert.deepEqual(config.deps, {});
  });

  it("has default skill paths", () => {
    const config = defaultConfig();
    assert.deepEqual(config.skills.paths, ["~/.cortex/ai/skills/*"]);
  });

  it("has default agent paths", () => {
    const config = defaultConfig();
    assert.deepEqual(config.agents.paths, ["~/.cortex/ai/agents/*"]);
  });
});

describe("TOML roundtrip", () => {
  it("serializes and deserializes without data loss", () => {
    const original: CortexConfig = {
      platforms: ["copilot", "gemini"],
      deps: { "design-doc": "https://github.com/example/repo" },
      skills: { paths: ["~/.cortex/ai/skills/*", "@design-doc/skills"] },
      agents: { paths: ["~/.cortex/ai/agents/*"] },
    };

    const toml = stringify(original as unknown as Record<string, unknown>);
    const parsed = parse(toml) as unknown as CortexConfig;

    assert.deepEqual(parsed.platforms, original.platforms);
    assert.deepEqual(parsed.deps, original.deps);
    assert.deepEqual(parsed.skills, original.skills);
    assert.deepEqual(parsed.agents, original.agents);
  });
});
