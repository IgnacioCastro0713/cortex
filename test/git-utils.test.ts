import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

let tmpDir: string;
const execFileMock = mock.fn(
  (_cmd: string, _args: string[], cb: (err: null, result: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: "mocked\n", stderr: "" });
  },
);

mock.module("node:child_process", {
  namedExports: { execFile: execFileMock },
});

const { gitPull, gitCloneOrPull } = await import("../src/git-utils.ts");

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cortex-git-test-"));
  execFileMock.mock.resetCalls();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true });
});

describe("gitPull", () => {
  it("calls git -C <dir> pull", async () => {
    execFileMock.mock.mockImplementation((_cmd, _args, cb) => {
      cb(null, { stdout: "Already up to date.\n", stderr: "" });
    });

    const result = await gitPull("/some/repo");

    assert.equal(result, "Already up to date.");
    assert.equal(execFileMock.mock.callCount(), 1);
    const args = execFileMock.mock.calls[0]?.arguments;
    assert.equal(args?.[0], "git");
    assert.deepEqual(args?.[1], ["-C", "/some/repo", "pull"]);
  });
});

describe("gitCloneOrPull", () => {
  it("clones when target is not a git repo", async () => {
    const targetDir = path.join(tmpDir, "new-repo");
    execFileMock.mock.mockImplementation((_cmd, _args, cb) => {
      cb(null, { stdout: "Cloning into...\n", stderr: "" });
    });

    const result = await gitCloneOrPull("https://github.com/example/repo", targetDir);

    assert.equal(result, "Cloning into...");
    const args = execFileMock.mock.calls[0]?.arguments;
    assert.equal(args?.[0], "git");
    assert.deepEqual(args?.[1], ["clone", "https://github.com/example/repo", targetDir]);
  });

  it("pulls when target is already a git repo", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"), { recursive: true });
    execFileMock.mock.mockImplementation((_cmd, _args, cb) => {
      cb(null, { stdout: "Updated.\n", stderr: "" });
    });

    const result = await gitCloneOrPull("https://github.com/example/repo", tmpDir);

    assert.equal(result, "Updated.");
    const args = execFileMock.mock.calls[0]?.arguments;
    assert.deepEqual(args?.[1], ["-C", tmpDir, "pull"]);
  });
});
