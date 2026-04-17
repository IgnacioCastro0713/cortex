import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const removeFileMock = mock.fn(async () => {});
const loadHashDBMock = mock.fn(async () => ({} as Record<string, string>));
const saveHashDBMock = mock.fn(async () => {});
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
  namedExports: {
    readConfigOrExit: readConfigOrExitMock,
    getSections: (config: { skills: { paths: string[] }; agents: { paths: string[] } }) => [
      { name: "skills", paths: config.skills.paths },
      { name: "agents", paths: config.agents.paths },
    ],
  },
});

mock.module(srcUrl("utils/fs-utils.ts"), {
  namedExports: { removeFile: removeFileMock, removeEmptyDirs: mock.fn(async () => {}) },
});

mock.module(srcUrl("core/hash-db.ts"), {
  namedExports: {
    loadHashDB: loadHashDBMock,
    saveHashDB: saveHashDBMock,
    normalizeKey: (p: string) => p.replace(/\\/g, "/"),
  },
});

mock.module(srcUrl("utils/log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("core/constants.ts"), {
  namedExports: {
    PLATFORMS: [{ name: "copilot", targetDir: ".github" }, { name: "gemini", targetDir: ".gemini" }],
    getPlatform: (name: string) => ({ copilot: { name: "copilot", targetDir: ".github" }, gemini: { name: "gemini", targetDir: ".gemini" } })[name],
  },
});

const { clean } = await import("../../src/commands/clean.ts");

const CWD = path.normalize("/tmp/project");

beforeEach(() => {
  removeFileMock.mock.resetCalls();
  saveHashDBMock.mock.resetCalls();
  loadHashDBMock.mock.resetCalls();
  for (const fn of Object.values(logMock)) fn.mock.resetCalls();
});

describe("clean", () => {
  it("removes managed files for all platform/section combos", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    const skillsFile = path.join(CWD, ".github", "skills", "planning.md").replace(/\\/g, "/");
    const agentsFile = path.join(CWD, ".github", "agents", "code-review.md").replace(/\\/g, "/");
    loadHashDBMock.mock.mockImplementation(async () => ({
      [skillsFile]: "abc",
      [agentsFile]: "def",
    }));

    await clean(CWD);

    assert.equal(removeFileMock.mock.callCount(), 2);
    assert.ok(logMock.success.mock.calls.some((c) => String(c.arguments[0]).includes("Removed 1")));
  });

  it("reports when no managed files found", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    loadHashDBMock.mock.mockImplementation(async () => ({}));

    await clean(CWD);

    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("No managed files")));
  });

  it("cleans across multiple platforms", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot", "gemini"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    const f1 = path.join(CWD, ".github", "skills", "a.md").replace(/\\/g, "/");
    const f2 = path.join(CWD, ".gemini", "skills", "a.md").replace(/\\/g, "/");
    loadHashDBMock.mock.mockImplementation(async () => ({ [f1]: "x", [f2]: "y" }));

    await clean(CWD);

    assert.equal(removeFileMock.mock.callCount(), 2);
    assert.equal(saveHashDBMock.mock.callCount(), 1);
  });
});
