import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

type Entry = { source: string; fileName: string };

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const resolveEntriesMock = mock.fn<(patterns: string[], cwd: string) => Promise<Entry[]>>();
const accessMock = mock.fn(async () => {});
const logMock = {
  plain: mock.fn(),
  success: mock.fn(),
  warn: mock.fn(),
  error: mock.fn(),
  info: mock.fn(),
  dim: mock.fn(),
};

mock.module(srcUrl("resolver.ts"), {
  namedExports: {
    readConfigOrExit: readConfigOrExitMock,
    resolveEntries: resolveEntriesMock,
    getSections: (config: { skills: { paths: string[] }; agents: { paths: string[] } }) => [
      { name: "skills", paths: config.skills.paths },
      { name: "agents", paths: config.agents.paths },
    ],
  },
});

mock.module("node:fs/promises", {
  namedExports: { access: accessMock },
  defaultExport: { access: accessMock },
});

mock.module(srcUrl("log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("constants.ts"), {
  namedExports: { PLATFORM_TARGETS: { copilot: ".github", gemini: ".gemini" } },
});

const { list } = await import("../../src/commands/list.ts");

const CWD = path.normalize("/tmp/project");

beforeEach(() => {
  resolveEntriesMock.mock.resetCalls();
  accessMock.mock.resetCalls();
  for (const fn of Object.values(logMock)) fn.mock.resetCalls();
});

describe("list", () => {
  it("shows resolved entries for each platform and section", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["~/.cortex/ai/skills/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (patterns, _cwd) => {
      if (patterns.length === 0) return [];
      return [{ source: "/home/user/.cortex/ai/skills/planning.md", fileName: "planning.md" }];
    });
    accessMock.mock.mockImplementation(async () => {});

    await list(CWD);

    assert.ok(logMock.success.mock.calls.some((c) => String(c.arguments[0]).includes("planning.md")));
    assert.ok(logMock.plain.mock.calls.some((c) => String(c.arguments[0]).includes("Total: 1")));
  });

  it("flags broken source paths", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: ["path/*"] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns, _cwd) => [
      { source: "/missing/broken.md", fileName: "broken.md" },
    ]);
    accessMock.mock.mockImplementation(async () => { throw new Error("ENOENT"); });

    await list(CWD);

    assert.ok(logMock.warn.mock.calls.some((c) => String(c.arguments[0]).includes("BROKEN")));
  });

  it("shows hint when no files resolved", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    resolveEntriesMock.mock.mockImplementation(async (_patterns, _cwd) => []);

    await list(CWD);

    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("no files resolved")));
    assert.ok(logMock.plain.mock.calls.some((c) => String(c.arguments[0]).includes("Total: 0")));
  });
});
