import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { expandPath } from "../src/fs-utils.ts";

const home = os.homedir();
const depsDir = path.join(home, ".cortex", "deps");
const cwd = path.normalize("C:/projects/my-app");

describe("expandPath", () => {
  it("resolves ~ to home directory", () => {
    const result = expandPath("~/.cortex/ai/skills/*", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(home, ".cortex/ai/skills/*")));
  });

  it("resolves ~/file.md", () => {
    const result = expandPath("~/notes.md", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(home, "notes.md")));
  });

  it("resolves @alias without subpath", () => {
    const result = expandPath("@my-repo", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(depsDir, "my-repo")));
  });

  it("resolves @alias with subpath", () => {
    const result = expandPath("@my-repo/skills/*.md", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(depsDir, "my-repo", "skills/*.md")));
  });

  it("resolves ./ relative to cwd", () => {
    const result = expandPath("./local/skills", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(cwd, "local/skills")));
  });

  it("resolves .\\ relative to cwd", () => {
    const result = expandPath(".\\local\\skills", depsDir, cwd);
    assert.equal(result, path.normalize(path.join(cwd, "local/skills")));
  });

  it("returns absolute paths normalized", () => {
    const result = expandPath("C:/some/absolute/path", depsDir, cwd);
    assert.equal(result, path.normalize("C:/some/absolute/path"));
  });
});
