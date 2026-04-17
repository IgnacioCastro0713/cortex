import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { isGitRepo } from "./fs-utils.ts";

const exec = promisify(execFile);

export async function gitPull(repoDir: string): Promise<string> {
  const { stdout } = await exec("git", ["-C", repoDir, "pull"]);
  return stdout.trim();
}

export async function gitCloneOrPull(url: string, targetDir: string): Promise<string> {
  if (await isGitRepo(targetDir)) return gitPull(targetDir);

  await mkdir(dirname(targetDir), { recursive: true });
  const { stdout } = await exec("git", ["clone", url, targetDir]);
  return stdout.trim();
}
