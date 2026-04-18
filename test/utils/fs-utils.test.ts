import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { expandPath } from "../../src/utils/fs-utils.ts";

const home = os.homedir();
const depsDir = path.join(home, ".cortex", "deps");

describe("expandPath", () => {
  it("resolves ~ to home directory", () => {
    const result = expandPath("~/.cortex/ai/skills/*", depsDir);
    assert.equal(result, path.normalize(path.join(home, ".cortex/ai/skills/*")));
  });

  it("resolves ~/file.md", () => {
    const result = expandPath("~/notes.md", depsDir);
    assert.equal(result, path.normalize(path.join(home, "notes.md")));
  });

  it("resolves @alias without subpath", () => {
    const result = expandPath("@my-repo", depsDir);
    assert.equal(result, path.normalize(path.join(depsDir, "my-repo")));
  });

  it("resolves @alias with subpath", () => {
    const result = expandPath("@my-repo/skills/*.md", depsDir);
    assert.equal(result, path.normalize(path.join(depsDir, "my-repo", "skills/*.md")));
  });

  it("returns absolute paths normalized", () => {
    const result = expandPath("C:/some/absolute/path", depsDir);
    assert.equal(result, path.normalize("C:/some/absolute/path"));
  });
});
