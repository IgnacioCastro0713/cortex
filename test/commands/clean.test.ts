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
const cleanMCPMock = mock.fn(async () => []);
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
  namedExports: { removeFile: removeFileMock, removeEmptyDirs: mock.fn(async () => {}), displayPath: (p: string) => p },
});

mock.module(srcUrl("core/hash-db.ts"), {
  namedExports: {
    loadHashDB: loadHashDBMock,
    saveHashDB: saveHashDBMock,
    normalizeKey: (p: string) => p.replace(/\\/g, "/"),
  },
});

mock.module(srcUrl("utils/log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("core/mcp.ts"), {
  namedExports: {
    cleanMCP: cleanMCPMock,
  },
});
mock.module(srcUrl("core/constants.ts"), {
  namedExports: {
    PLATFORMS: [{ name: "copilot", targetDir: "/mock/home/.github" }, { name: "gemini", targetDir: "/mock/home/.gemini" }],
    getPlatform: (name: string) => ({ copilot: { name: "copilot", targetDir: "/mock/home/.github" }, gemini: { name: "gemini", targetDir: "/mock/home/.gemini" } })[name],
  },
});

const { clean } = await import("../../src/commands/clean.ts");

beforeEach(() => {
  removeFileMock.mock.resetCalls();
  saveHashDBMock.mock.resetCalls();
  loadHashDBMock.mock.resetCalls();
  cleanMCPMock.mock.resetCalls();
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
    const skillsFile = "/mock/home/.github/skills/planning.md";
    const agentsFile = "/mock/home/.github/agents/code-review.md";
    loadHashDBMock.mock.mockImplementation(async () => ({
      [skillsFile]: "abc",
      [agentsFile]: "def",
    }));

    await clean({ force: true });

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

    await clean();

    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("Nothing managed")));
  });

  it("cleans across multiple platforms", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot", "gemini"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    const f1 = "/mock/home/.github/skills/a.md";
    const f2 = "/mock/home/.gemini/skills/a.md";
    loadHashDBMock.mock.mockImplementation(async () => ({ [f1]: "x", [f2]: "y" }));

    await clean({ force: true });

    assert.equal(removeFileMock.mock.callCount(), 2);
    assert.equal(saveHashDBMock.mock.callCount(), 1);
  });
});
