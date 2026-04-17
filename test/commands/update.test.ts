import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const isGitRepoMock = mock.fn<(dir: string) => Promise<boolean>>(async () => false);
const gitPullMock = mock.fn<(dir: string) => Promise<string>>(async () => "");
const gitCloneOrPullMock = mock.fn<(url: string, dir: string) => Promise<string>>(async () => "");
const spinnerMock = { start: mock.fn(), stop: mock.fn() };
const logMock = {
  plain: mock.fn(),
  success: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  info: mock.fn(),
  dim: mock.fn(),
  header: mock.fn(),
  separator: mock.fn(),
  outro: mock.fn(),
};

mock.module(srcUrl("core/resolver.ts"), {
  namedExports: { readConfigOrExit: readConfigOrExitMock },
});

mock.module(srcUrl("utils/fs-utils.ts"), {
  namedExports: { isGitRepo: isGitRepoMock },
});

mock.module(srcUrl("utils/git-utils.ts"), {
  namedExports: { gitPull: gitPullMock, gitCloneOrPull: gitCloneOrPullMock },
});

mock.module(srcUrl("utils/log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("core/constants.ts"), {
  namedExports: {
    AI_DIR: "/home/user/.cortex/ai",
    DEPS_DIR: "/home/user/.cortex/deps",
  },
});

const { update } = await import("../../src/commands/update.ts");

beforeEach(() => {
  for (const fn of [readConfigOrExitMock, isGitRepoMock, gitPullMock, gitCloneOrPullMock]) {
    fn.mock.resetCalls();
  }
  for (const fn of Object.values(logMock)) fn.mock.resetCalls();
  spinnerMock.start.mock.resetCalls();
  spinnerMock.stop.mock.resetCalls();
});

describe("update", () => {
  it("pulls AI_DIR when it is a git repo", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: [],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    isGitRepoMock.mock.mockImplementation(async () => true);
    gitPullMock.mock.mockImplementation(async () => "Already up to date.");

    await update();

    assert.equal(gitPullMock.mock.callCount(), 1);
    assert.equal(gitPullMock.mock.calls[0]!.arguments[0], "/home/user/.cortex/ai");
  });

  it("skips pull when AI_DIR is not a git repo", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: [],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    isGitRepoMock.mock.mockImplementation(async () => false);

    await update();

    assert.equal(gitPullMock.mock.callCount(), 0);
    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("not a git repo")));
  });

  it("clones or pulls each dependency", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: [],
      deps: {
        "design-doc": "https://github.com/example/design-doc",
        "utils": "https://github.com/example/utils",
      },
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    isGitRepoMock.mock.mockImplementation(async () => false);
    gitCloneOrPullMock.mock.mockImplementation(async () => "Done.");

    await update();

    assert.equal(gitCloneOrPullMock.mock.callCount(), 2);
    const firstArgs = gitCloneOrPullMock.mock.calls[0]!.arguments;
    assert.equal(firstArgs[0], "https://github.com/example/design-doc");
    assert.ok(String(firstArgs[1]).includes("design-doc"));
  });

  it("reports when no deps defined", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: [],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    isGitRepoMock.mock.mockImplementation(async () => false);

    await update();

    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("No dependencies")));
  });
});
