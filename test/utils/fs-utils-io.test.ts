import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveGlob, isGitRepo } from "../../src/utils/fs-utils.ts";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-test-"));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true });
});

describe("resolveGlob", () => {
  it("returns existing file for non-wildcard path", async () => {
    const file = path.join(tmpDir, "skill.md");
    await fs.writeFile(file, "content");
    const result = await resolveGlob(file);
    assert.equal(result.length, 1);
    assert.equal(result[0], path.resolve(file));
  });

  it("returns empty for non-existing non-wildcard path", async () => {
    const result = await resolveGlob(path.join(tmpDir, "nope.md"));
    assert.equal(result.length, 0);
  });

  it("returns existing directory for non-wildcard path", async () => {
    const dir = path.join(tmpDir, "my-skill");
    await fs.mkdir(dir);
    const result = await resolveGlob(dir);
    assert.equal(result.length, 1);
    assert.equal(result[0], path.resolve(dir));
  });

  it("resolves .md files with wildcard", async () => {
    await fs.writeFile(path.join(tmpDir, "a.md"), "");
    await fs.writeFile(path.join(tmpDir, "b.md"), "");
    await fs.writeFile(path.join(tmpDir, "c.txt"), "");
    const result = await resolveGlob(path.join(tmpDir, "*"));
    const names = result.map((r) => path.basename(r)).sort();
    assert.ok(names.includes("a.md"));
    assert.ok(names.includes("b.md"));
    assert.ok(!names.includes("c.txt"));
  });

  it("resolves directories with wildcard", async () => {
    await fs.mkdir(path.join(tmpDir, "skill-dir"));
    const result = await resolveGlob(path.join(tmpDir, "*"));
    assert.equal(result.length, 1);
    assert.equal(path.basename(result[0]!), "skill-dir");
  });
});

describe("isGitRepo", () => {
  it("returns true when .git exists", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    assert.equal(await isGitRepo(tmpDir), true);
  });

  it("returns false when .git does not exist", async () => {
    assert.equal(await isGitRepo(tmpDir), false);
  });
});
