import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { resolveGlob, createSymlink, cleanSymlinks, isGitRepo } from "../../src/utils/fs-utils.ts";

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

describe("createSymlink", () => {
  it("creates a symlink to a file", async () => {
    const target = path.join(tmpDir, "source.md");
    const link = path.join(tmpDir, "link.md");
    await fs.writeFile(target, "hello");

    await createSymlink(target, link);

    const stat = await fs.lstat(link);
    assert.ok(stat.isSymbolicLink());
    const content = await fs.readFile(link, "utf-8");
    assert.equal(content, "hello");
  });

  it("creates parent directories for the link", async () => {
    const target = path.join(tmpDir, "source.md");
    const link = path.join(tmpDir, "deep", "nested", "link.md");
    await fs.writeFile(target, "data");

    await createSymlink(target, link);

    const stat = await fs.lstat(link);
    assert.ok(stat.isSymbolicLink());
  });

  it("overwrites an existing symlink", async () => {
    const target1 = path.join(tmpDir, "first.md");
    const target2 = path.join(tmpDir, "second.md");
    const link = path.join(tmpDir, "link.md");
    await fs.writeFile(target1, "first");
    await fs.writeFile(target2, "second");

    await createSymlink(target1, link);
    await createSymlink(target2, link);

    const content = await fs.readFile(link, "utf-8");
    assert.equal(content, "second");
  });
});

describe("cleanSymlinks", () => {
  it("removes symlinks from a directory", async () => {
    const target = path.join(tmpDir, "source.md");
    const dir = path.join(tmpDir, "links");
    await fs.writeFile(target, "content");
    await fs.mkdir(dir);
    await fs.symlink(target, path.join(dir, "link.md"));

    const removed = await cleanSymlinks(dir);
    assert.equal(removed, 1);

    const entries = await fs.readdir(dir);
    assert.equal(entries.length, 0);
  });

  it("leaves regular files untouched", async () => {
    const dir = path.join(tmpDir, "mixed");
    await fs.mkdir(dir);
    await fs.writeFile(path.join(dir, "regular.md"), "keep me");

    const target = path.join(tmpDir, "source.md");
    await fs.writeFile(target, "");
    await fs.symlink(target, path.join(dir, "link.md"));

    const removed = await cleanSymlinks(dir);
    assert.equal(removed, 1);

    const entries = await fs.readdir(dir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0], "regular.md");
  });

  it("returns 0 for non-existent directory", async () => {
    const removed = await cleanSymlinks(path.join(tmpDir, "nope"));
    assert.equal(removed, 0);
  });

  it("returns 0 for empty directory", async () => {
    const dir = path.join(tmpDir, "empty");
    await fs.mkdir(dir);
    const removed = await cleanSymlinks(dir);
    assert.equal(removed, 0);
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
