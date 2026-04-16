import { describe, it, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src");
const srcUrl = (file: string) => pathToFileURL(path.join(srcDir, file)).href;

const readConfigOrExitMock = mock.fn<() => Promise<unknown>>();
const cleanSymlinksMock = mock.fn<() => Promise<number>>(async () => 0);
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
    getSections: (config: { skills: { paths: string[] }; agents: { paths: string[] } }) => [
      { name: "skills", paths: config.skills.paths },
      { name: "agents", paths: config.agents.paths },
    ],
  },
});

mock.module(srcUrl("fs-utils.ts"), {
  namedExports: { cleanSymlinks: cleanSymlinksMock },
});

mock.module(srcUrl("log.ts"), { namedExports: { log: logMock } });
mock.module(srcUrl("constants.ts"), {
  namedExports: { PLATFORM_TARGETS: { copilot: ".github", gemini: ".gemini" } },
});

const { clean } = await import("../../src/commands/clean.ts");

const CWD = path.normalize("/tmp/project");

beforeEach(() => {
  cleanSymlinksMock.mock.resetCalls();
  for (const fn of Object.values(logMock)) fn.mock.resetCalls();
});

describe("clean", () => {
  it("cleans symlinks for all platform/section combos", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    cleanSymlinksMock.mock.mockImplementation(async () => 3);

    await clean(CWD);

    // copilot → skills + agents = 2 calls
    assert.equal(cleanSymlinksMock.mock.callCount(), 2);
    assert.ok(logMock.success.mock.calls.some((c) => String(c.arguments[0]).includes("Removed 3")));
  });

  it("reports when no links found", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    cleanSymlinksMock.mock.mockImplementation(async () => 0);

    await clean(CWD);

    assert.ok(logMock.dim.mock.calls.some((c) => String(c.arguments[0]).includes("No links")));
  });

  it("cleans across multiple platforms", async () => {
    readConfigOrExitMock.mock.mockImplementation(async () => ({
      platforms: ["copilot", "gemini"],
      deps: {},
      skills: { paths: [] },
      agents: { paths: [] },
    }));
    cleanSymlinksMock.mock.mockImplementation(async () => 1);

    await clean(CWD);

    // 2 platforms × 2 sections = 4 calls
    assert.equal(cleanSymlinksMock.mock.callCount(), 4);
  });
});
