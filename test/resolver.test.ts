import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ResolvedEntry } from "../src/resolver.ts";
import { deduplicateEntries, getSections } from "../src/resolver.ts";

describe("deduplicateEntries", () => {
  it("returns entries as-is when no duplicates", () => {
    const entries: ResolvedEntry[] = [
      { source: "/a/foo.md", fileName: "foo.md" },
      { source: "/a/bar.md", fileName: "bar.md" },
    ];
    const result = deduplicateEntries(entries);
    assert.equal(result.length, 2);
    assert.equal(result[0]?.fileName, "foo.md");
    assert.equal(result[1]?.fileName, "bar.md");
  });

  it("keeps last match on duplicate fileName", () => {
    const entries: ResolvedEntry[] = [
      { source: "/a/foo.md", fileName: "foo.md" },
      { source: "/b/foo.md", fileName: "foo.md" },
    ];
    const result = deduplicateEntries(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0]?.source, "/b/foo.md");
  });

  it("returns empty array for empty input", () => {
    const result = deduplicateEntries([]);
    assert.equal(result.length, 0);
  });
});

describe("getSections", () => {
  it("returns skills and agents sections", () => {
    const config = {
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: ["~/.cortex/ai/agents/*"] },
    };
    const sections = getSections(config);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].name, "skills");
    assert.deepEqual(sections[0].paths, ["~/.cortex/ai/skills/*"]);
    assert.equal(sections[1].name, "agents");
    assert.deepEqual(sections[1].paths, ["~/.cortex/ai/agents/*"]);
  });

  it("handles empty paths", () => {
    const config = {
      skills: { paths: [] },
      agents: { paths: [] },
    };
    const sections = getSections(config);
    assert.equal(sections[0].paths.length, 0);
    assert.equal(sections[1].paths.length, 0);
  });
});
