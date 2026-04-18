import path from "node:path";
import { styleText } from "node:util";
import { removeFile, removeEmptyDirs } from "../utils/fs-utils.ts";
import { log } from "../utils/log.ts";
import { getPlatform } from "../core/constants.ts";
import { getSections, readConfigOrExit } from "../core/resolver.ts";
import { loadHashDB, saveHashDB, normalizeKey } from "../core/hash-db.ts";
import { displayPath } from "../core/mcp.ts";

export async function clean(): Promise<void> {
  log.header("clean");

  const config = await readConfigOrExit();
  const hashDB = await loadHashDB();
  let total = 0;

  for (const platformName of config.platforms) {
    const platform = getPlatform(platformName);
    if (!platform) continue;
    const { name, targetDir } = platform;

    console.log(`${styleText("cyan", "●")}  ${name}  ${styleText("dim", `(${displayPath(targetDir)}/)`)}`);

    for (const section of getSections(config)) {
      const targetDirPath = path.join(targetDir, section.name);
      const removed: string[] = [];

      for (const destPath of Object.keys(hashDB)) {
        if (destPath.startsWith(normalizeKey(targetDirPath) + "/")) {
          await removeFile(destPath);
          await removeEmptyDirs(path.dirname(destPath), targetDirPath);
          delete hashDB[destPath];
          removed.push(destPath);
        }
      }

      if (removed.length > 0) {
        log.success(`Removed ${removed.length} file(s) from ${displayPath(targetDir)}/${section.name}/`);
        total += removed.length;
      } else {
        log.dim(`No managed files in ${displayPath(targetDir)}/${section.name}/`);
      }
    }
  }

  await saveHashDB(hashDB);

  console.log();
  log.success(`Cleaned ${total} file(s) total.`);
}
